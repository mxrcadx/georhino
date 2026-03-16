import { contours } from 'd3-contour';
import type { ElevationGrid } from '@/types/dem';
import type { FeatureCollection, Feature, LineString } from 'geojson';

/**
 * Hard cap on total contour lines. If we exceed this, we increase the interval
 * and regenerate until we're under the limit.
 */
const MAX_CONTOUR_LINES = 1000;

/**
 * Minimum number of points for a contour line to be kept.
 * Removes tiny noise fragments.
 */
const MIN_POINTS_PER_LINE = 4;

export function generateContours(
  grid: ElevationGrid,
  interval: number,
  majorEvery: number
): FeatureCollection {
  const { data, width, height, bbox, noDataValue } = grid;

  // Find elevation range
  let minElev = Infinity;
  let maxElev = -Infinity;
  const cleanData = new Float64Array(data.length);

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v === noDataValue || !isFinite(v)) {
      cleanData[i] = NaN;
    } else {
      cleanData[i] = v;
      if (v < minElev) minElev = v;
      if (v > maxElev) maxElev = v;
    }
  }

  if (!isFinite(minElev) || !isFinite(maxElev)) {
    return { type: 'FeatureCollection', features: [] };
  }

  // Try generating contours, increasing interval if we exceed MAX_CONTOUR_LINES
  let currentInterval = interval;
  let features: Feature<LineString>[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    features = extractContourLines(cleanData, width, height, bbox, currentInterval, majorEvery);

    if (features.length <= MAX_CONTOUR_LINES) break;

    // Too many lines — double the interval and try again
    console.warn(
      `Contour count ${features.length} exceeds max ${MAX_CONTOUR_LINES}. ` +
      `Increasing interval from ${currentInterval}m to ${currentInterval * 2}m.`
    );
    currentInterval *= 2;
  }

  // If still too many after 5 attempts, keep only the longest lines
  if (features.length > MAX_CONTOUR_LINES) {
    // Sort by point count (longer = more important), keep top N
    features.sort((a, b) => b.geometry.coordinates.length - a.geometry.coordinates.length);
    features = features.slice(0, MAX_CONTOUR_LINES);
  }

  return { type: 'FeatureCollection', features };
}

function extractContourLines(
  cleanData: Float64Array,
  width: number,
  height: number,
  bbox: { west: number; south: number; east: number; north: number },
  interval: number,
  majorEvery: number
): Feature<LineString>[] {
  // Find elevation range from clean data
  let minElev = Infinity;
  let maxElev = -Infinity;
  for (let i = 0; i < cleanData.length; i++) {
    const v = cleanData[i];
    if (isFinite(v)) {
      if (v < minElev) minElev = v;
      if (v > maxElev) maxElev = v;
    }
  }

  // Generate thresholds
  const startElev = Math.ceil(minElev / interval) * interval;
  const thresholds: number[] = [];
  for (let e = startElev; e <= maxElev; e += interval) {
    thresholds.push(e);
  }

  if (thresholds.length === 0) return [];

  // Run d3-contour
  const contourGenerator = contours()
    .size([width, height])
    .smooth(true)
    .thresholds(thresholds);

  const contourMultiPolygons = contourGenerator(Array.from(cleanData));

  // Extract contour lines from polygon boundaries
  const features: Feature<LineString>[] = [];

  for (const mp of contourMultiPolygons) {
    const elevation = mp.value;
    const thresholdIndex = thresholds.indexOf(elevation);
    const isMajor = majorEvery > 0 && thresholdIndex >= 0 && thresholdIndex % majorEvery === 0;

    for (const polygon of mp.coordinates) {
      for (const ring of polygon) {
        if (ring.length < MIN_POINTS_PER_LINE) continue;

        // Convert pixel coordinates to geographic coordinates
        const geoCoords: [number, number][] = ring.map(([px, py]) => {
          const lng = bbox.west + (px / width) * (bbox.east - bbox.west);
          const lat = bbox.north - (py / height) * (bbox.north - bbox.south);
          return [lng, lat] as [number, number];
        });

        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: geoCoords,
          },
          properties: {
            elevation,
            elevationFeet: Math.round(elevation * 3.28084),
            isMajor,
            interval,
          },
        });
      }
    }
  }

  return features;
}
