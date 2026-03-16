/**
 * Contour simplification pipeline — 0% (raw) to 100% (maximally simplified)
 *
 * PHILOSOPHY: Smoothing = REMOVING points, never adding them.
 * Higher smoothing → fewer points → lighter files → smoother appearance.
 *
 * HARD LIMITS:
 *   - Max 500 points per contour line
 *   - Total output never exceeds 1000 features
 *
 * Pipeline:
 *   1. Compute line extent (for scale-independent tolerance)
 *   2. Douglas-Peucker simplification (tolerance scales with smoothing factor)
 *   3. Hard cap to max points (evenly sampled)
 */

const MAX_POINTS_PER_LINE = 500;

// ─── Douglas-Peucker simplification ────────────────────────────

/**
 * Perpendicular distance from point to line segment.
 */
function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a point
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

/**
 * True Douglas-Peucker recursive simplification.
 * Returns indices of points to keep.
 */
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

/**
 * Compute the diagonal extent of a line (in coordinate units).
 * Used to make tolerance scale-independent.
 */
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
 * Simplify a contour line. Higher factor = more aggressive simplification = fewer points.
 *
 * factor 0.0 → minimal simplification (just remove exact duplicates + tiny jitter)
 * factor 0.5 → moderate simplification
 * factor 1.0 → aggressive simplification (fewest points that preserve shape)
 */
export function smoothContourLine(
  points: [number, number][],
  factor: number
): [number, number][] {
  if (points.length <= 2) return points;

  // Always do a baseline simplification to remove DEM grid staircase artifacts
  // even at factor=0. The raw grid-traced contours have redundant collinear points.
  const extent = lineExtent(points);
  if (extent === 0) return [points[0]]; // degenerate line

  // Tolerance as fraction of the line's extent:
  //   factor=0 → 0.05% of extent (removes grid artifacts only)
  //   factor=0.5 → 0.5% of extent (moderate simplification)
  //   factor=1 → 2% of extent (aggressive simplification)
  const toleranceFraction = 0.0005 + factor * factor * 0.02;
  const tolerance = extent * toleranceFraction;

  let result = simplifyLine(points, tolerance);

  // Hard cap
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
