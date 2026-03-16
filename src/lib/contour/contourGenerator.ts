import { contours } from 'd3-contour';
import type { ElevationGrid } from '@/types/dem';
import type { FeatureCollection, Feature, LineString } from 'geojson';

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

  // Generate thresholds
  const startElev = Math.ceil(minElev / interval) * interval;
  const thresholds: number[] = [];
  for (let e = startElev; e <= maxElev; e += interval) {
    thresholds.push(e);
  }

  if (thresholds.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

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
    const isMajor = thresholdIndex >= 0 && thresholdIndex % majorEvery === 0;

    // Extract rings from MultiPolygon coordinates
    for (const polygon of mp.coordinates) {
      for (const ring of polygon) {
        if (ring.length < 3) continue;

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

  return { type: 'FeatureCollection', features };
}
