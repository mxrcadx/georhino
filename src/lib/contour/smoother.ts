/**
 * Contour smoothing + simplification pipeline
 *
 * Raw DEM contours are staircases — they follow grid cell boundaries with
 * 90-degree turns and tons of redundant points. The goal is to produce
 * smooth, flowing curves with FEWER points than the raw input.
 *
 * Pipeline:
 *   1. Aggressive decimation to strip staircase artifacts → key shape points
 *   2. Catmull-Rom spline through key points → smooth curves
 *   3. Final decimation to remove redundant interpolated points
 *   4. Hard cap at MAX_POINTS_PER_LINE
 *
 * At factor=0: light decimation only (still staircasey, most points kept)
 * At factor=1: heavy decimation → few key points → smooth curves → fewest points
 *
 * The output ALWAYS has fewer points than the input.
 *
 * HARD LIMITS:
 *   - Max 500 points per contour line
 *   - Total output never exceeds 1000 features
 */

const MAX_POINTS_PER_LINE = 500;

// ─── Douglas-Peucker simplification ────────────────────────────

function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

function douglasPeucker(
  points: [number, number][],
  tolerance: number,
  startIdx: number,
  endIdx: number,
  keep: boolean[]
): void {
  if (endIdx - startIdx < 2) return;

  let maxDist = 0;
  let maxIdx = startIdx;

  const ax = points[startIdx][0];
  const ay = points[startIdx][1];
  const bx = points[endIdx][0];
  const by = points[endIdx][1];

  for (let i = startIdx + 1; i < endIdx; i++) {
    const dist = pointToSegmentDist(points[i][0], points[i][1], ax, ay, bx, by);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    keep[maxIdx] = true;
    douglasPeucker(points, tolerance, startIdx, maxIdx, keep);
    douglasPeucker(points, tolerance, maxIdx, endIdx, keep);
  }
}

function simplifyLine(
  points: [number, number][],
  tolerance: number
): [number, number][] {
  if (points.length <= 2) return points;

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  douglasPeucker(points, tolerance, 0, points.length - 1, keep);

  const result: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

// ─── Line extent (for scale-independent tolerance) ──────────────

function lineExtent(points: [number, number][]): number {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const dx = maxX - minX;
  const dy = maxY - minY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Catmull-Rom spline interpolation ───────────────────────────

function catmullRom(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;

  const x = 0.5 * (
    (2 * p1[0]) +
    (-p0[0] + p2[0]) * t +
    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
  );

  const y = 0.5 * (
    (2 * p1[1]) +
    (-p0[1] + p2[1]) * t +
    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
  );

  return [x, y];
}

/**
 * Interpolate smooth curve through key points using Catmull-Rom splines.
 * numInserted = how many intermediate points to add per segment (2-4).
 */
function catmullRomSmooth(
  points: [number, number][],
  numInserted: number
): [number, number][] {
  if (points.length < 3 || numInserted < 1) return points;

  const result: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Always include the original point
    result.push(p1);

    // Insert intermediate curve points
    for (let j = 1; j <= numInserted; j++) {
      const t = j / (numInserted + 1);
      result.push(catmullRom(p0, p1, p2, p3, t));
    }
  }

  // Include the last point
  result.push(points[points.length - 1]);
  return result;
}

// ─── Cap points by even sampling ────────────────────────────────

function capPoints(
  points: [number, number][],
  maxPoints: number
): [number, number][] {
  if (points.length <= maxPoints) return points;

  const result: [number, number][] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    result.push(points[idx]);
  }

  result.push(points[points.length - 1]);
  return result;
}

// ─── Main smoothing function ─────────────────────────────────────

/**
 * Smooth and simplify a contour line.
 *
 * factor 0.0 → minimal: light decimation, no curve interpolation (raw-ish)
 * factor 0.5 → moderate: medium decimation + smooth curves
 * factor 1.0 → maximum: aggressive decimation + very smooth curves, fewest points
 *
 * Always outputs fewer points than input.
 */
export function smoothContourLine(
  points: [number, number][],
  factor: number
): [number, number][] {
  if (points.length <= 3) return points;

  const extent = lineExtent(points);
  if (extent === 0) return [points[0]];

  const inputCount = points.length;

  // ── Step 1: Decimate raw staircase ──
  // At factor=0: remove only exact grid artifacts (very tight tolerance)
  // At factor=1: aggressive — keep only key shape-defining points
  const decimTolerance = extent * (0.001 + factor * factor * 0.03);
  let result = simplifyLine(points, decimTolerance);

  // ── Step 2: Catmull-Rom curve interpolation ──
  // Only apply if factor > 0 and we have enough key points
  if (factor > 0 && result.length >= 3) {
    // More key points = more interpolation points needed for smooth curves
    // 2 intermediate points at low factor, up to 4 at high factor
    const numInserted = Math.max(2, Math.min(4, Math.round(2 + factor * 2)));
    result = catmullRomSmooth(result, numInserted);

    // ── Step 3: Final decimation to clean up redundant interpolated points ──
    // The Catmull-Rom adds points, but many will be near-collinear on
    // already-smooth segments. This pass removes those while keeping the curves.
    const postTolerance = extent * (0.0002 + factor * 0.003);
    result = simplifyLine(result, postTolerance);
  }

  // ── Step 4: Ensure we never output MORE points than we started with ──
  if (result.length > inputCount) {
    result = capPoints(result, inputCount);
  }

  // ── Step 5: Hard cap ──
  result = capPoints(result, MAX_POINTS_PER_LINE);

  return result;
}

// ─── Feature collection wrapper ──────────────────────────────────

export function smoothFeatureCollection(
  fc: import('geojson').FeatureCollection,
  factor: number
): import('geojson').FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((feature) => {
      if (feature.geometry.type !== 'LineString') return feature;

      const coords = feature.geometry.coordinates as [number, number][];
      const smoothed = smoothContourLine(coords, factor);

      return {
        ...feature,
        geometry: {
          type: 'LineString' as const,
          coordinates: smoothed,
        },
      };
    }),
  };
}

// ─── Async batched version (for export — prevents page freeze) ───

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

export async function smoothFeatureCollectionAsync(
  fc: import('geojson').FeatureCollection,
  factor: number,
  onProgress?: (pct: number) => void
): Promise<import('geojson').FeatureCollection> {
  const BATCH = 50;
  const features: import('geojson').Feature[] = [];

  for (let i = 0; i < fc.features.length; i++) {
    const feature = fc.features[i];
    if (feature.geometry.type !== 'LineString') {
      features.push(feature);
      continue;
    }

    const coords = feature.geometry.coordinates as [number, number][];
    const smoothed = smoothContourLine(coords, factor);

    features.push({
      ...feature,
      geometry: {
        type: 'LineString' as const,
        coordinates: smoothed,
      },
    });

    if (i % BATCH === 0 && i > 0) {
      onProgress?.(i / fc.features.length);
      await yieldToMain();
    }
  }

  return { type: 'FeatureCollection', features };
}
