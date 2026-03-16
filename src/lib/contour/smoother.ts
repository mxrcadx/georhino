/**
 * Multi-stage contour smoothing pipeline:
 *
 * Stage 1 (factor 0–1.0, slider 0–100%):
 *   Catmull-Rom spline interpolation — inserts curved points between
 *   original vertices. Passes through all original points, so the shape
 *   is preserved but the line segments become curved.
 *
 * Stage 2 (factor 1.0–2.0, slider 100–200%):
 *   Chaikin corner-cutting — iteratively replaces each segment with two
 *   shorter segments that "cut the corner." This does NOT pass through
 *   the original points, producing genuinely smooth curves at the cost
 *   of some positional fidelity. More iterations = smoother but less
 *   true to the original DEM grid.
 */

// ─── Catmull-Rom spline ───────────────────────────────────────────

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

    for (let j = 0; j < numInserted; j++) {
      const t = j / numInserted;
      result.push(catmullRom(p0, p1, p2, p3, t));
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

// ─── Chaikin corner-cutting ───────────────────────────────────────

function chaikinSmooth(
  points: [number, number][],
  iterations: number
): [number, number][] {
  if (points.length < 3 || iterations < 1) return points;

  let result = points;

  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: [number, number][] = [];

    // Keep the first point anchored
    newPoints.push(result[0]);

    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];

      // Q point: 3/4 of p0, 1/4 of p1
      newPoints.push([
        0.75 * p0[0] + 0.25 * p1[0],
        0.75 * p0[1] + 0.25 * p1[1],
      ]);

      // R point: 1/4 of p0, 3/4 of p1
      newPoints.push([
        0.25 * p0[0] + 0.75 * p1[0],
        0.25 * p0[1] + 0.75 * p1[1],
      ]);
    }

    // Keep the last point anchored
    newPoints.push(result[result.length - 1]);

    result = newPoints;
  }

  return result;
}

// ─── Point decimation (Douglas-Peucker-like) ─────────────────────
// Removes redundant collinear points from grid-aligned staircase
// patterns before smoothing, so the smoother has cleaner input.

function decimatePoints(
  points: [number, number][],
  tolerance: number
): [number, number][] {
  if (points.length <= 3) return points;

  const result: [number, number][] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Check if current point is roughly collinear with prev and next
    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const dx2 = next[0] - prev[0];
    const dy2 = next[1] - prev[1];

    // Cross product gives area of parallelogram — if small, points are collinear
    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    const len = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    // Distance from point to line prev→next
    const dist = len > 0 ? cross / len : 0;

    if (dist > tolerance) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

// ─── Main smoothing function ─────────────────────────────────────

export function smoothContourLine(
  points: [number, number][],
  factor: number
): [number, number][] {
  if (factor <= 0 || points.length < 3) return points;

  let result = points;

  if (factor <= 1.0) {
    // Stage 1: Catmull-Rom only (0–100%)
    // Scale interpolation points from 1 to 12
    const numInserted = Math.max(1, Math.round(factor * 12));
    result = catmullRomSmooth(result, numInserted);
  } else {
    // Stage 2: Beyond 100% — multi-pass pipeline

    // First, decimate grid-staircase artifacts
    // Use a small tolerance based on average point spacing
    if (result.length > 10) {
      let totalDist = 0;
      for (let i = 1; i < Math.min(result.length, 50); i++) {
        const dx = result[i][0] - result[i - 1][0];
        const dy = result[i][1] - result[i - 1][1];
        totalDist += Math.sqrt(dx * dx + dy * dy);
      }
      const avgSpacing = totalDist / Math.min(result.length - 1, 49);
      // Remove points within 30% of grid spacing (removes staircase steps)
      result = decimatePoints(result, avgSpacing * 0.3);
    }

    // Then Catmull-Rom at full resolution
    result = catmullRomSmooth(result, 12);

    // Then Chaikin corner-cutting for genuine smoothing
    // factor 1.0→2.0 maps to 1→5 Chaikin iterations
    const chaikinIter = Math.round((factor - 1.0) * 5);
    if (chaikinIter > 0) {
      result = chaikinSmooth(result, chaikinIter);
    }
  }

  return result;
}

// ─── Feature collection wrapper ──────────────────────────────────

export function smoothFeatureCollection(
  fc: import('geojson').FeatureCollection,
  factor: number
): import('geojson').FeatureCollection {
  if (factor <= 0) return fc;

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
