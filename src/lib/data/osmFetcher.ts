import type { BoundingBox } from '@/types/geo';
import type { LayerName } from '@/types/layers';
import type { FeatureCollection, Feature, Geometry } from 'geojson';

function buildOverpassQuery(layer: LayerName, bbox: BoundingBox): string {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const header = `[out:json][timeout:120][maxsize:67108864]`;

  const queries: Record<string, string> = {
    buildings: `${header};(way["building"](${b});relation["building"](${b}););out body;>;out skel qt;`,
    roads: `${header};way["highway"](${b});out body;>;out skel qt;`,
    water: `${header};(way["natural"="water"](${b});relation["natural"="water"](${b});way["waterway"](${b});way["natural"="coastline"](${b}););out body;>;out skel qt;`,
    landuse: `${header};(way["landuse"](${b});relation["landuse"](${b});way["leisure"="park"](${b});relation["leisure"="park"](${b}););out body;>;out skel qt;`,
    infrastructure: `${header};(way["power"](${b});node["power"](${b});way["man_made"="pipeline"](${b});node["man_made"="tower"](${b});node["telecom"](${b}););out body;>;out skel qt;`,
  };

  return queries[layer] || '';
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
}

function overpassToGeoJSON(elements: OverpassElement[], layer: LayerName): FeatureCollection {
  // Build node lookup
  const nodeMap = new Map<number, [number, number]>();
  for (const el of elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, [el.lon, el.lat]);
    }
  }

  const features: Feature[] = [];

  for (const el of elements) {
    if (el.type === 'way' && el.nodes) {
      const coords: [number, number][] = [];
      for (const nodeId of el.nodes) {
        const coord = nodeMap.get(nodeId);
        if (coord) coords.push(coord);
      }
      if (coords.length < 2) continue;

      // Determine if polygon (closed way) or linestring
      const isPolygon = coords.length >= 4 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1];

      const shouldBePolygon = isPolygon && (
        layer === 'buildings' || layer === 'water' || layer === 'landuse'
      );

      const geometry: Geometry = shouldBePolygon
        ? { type: 'Polygon', coordinates: [coords] }
        : { type: 'LineString', coordinates: coords };

      const properties: Record<string, any> = { osm_id: el.id };
      if (el.tags) {
        Object.assign(properties, el.tags);
        // Classify road hierarchy
        if (layer === 'roads' && el.tags.highway) {
          const highwayType = el.tags.highway;
          properties.roadClass = ['motorway', 'trunk', 'primary', 'secondary'].includes(highwayType)
            ? 'highway'
            : 'local';
        }
      }

      features.push({ type: 'Feature', geometry, properties });
    }

    // Handle node features (infrastructure points)
    if (el.type === 'node' && el.tags && Object.keys(el.tags).length > 0 && el.lat !== undefined) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [el.lon!, el.lat] },
        properties: { osm_id: el.id, ...el.tags },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

export async function fetchOsmData(layer: LayerName, bbox: BoundingBox): Promise<FeatureCollection> {
  if (layer === 'contours') {
    throw new Error('Use fetchElevationData for contour data');
  }

  const query = buildOverpassQuery(layer, bbox);
  if (!query) {
    return { type: 'FeatureCollection', features: [] };
  }

  const response = await fetch('/api/osm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    let errorMsg: string;
    try {
      const data = await response.json();
      errorMsg = data.error || `HTTP ${response.status}`;
    } catch {
      errorMsg = `HTTP ${response.status}`;
    }
    // Clean up error message — strip XML/HTML
    if (errorMsg.includes('<?xml') || errorMsg.includes('<!DOCTYPE')) {
      errorMsg = `Server timeout (${response.status}). Try a smaller area.`;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return overpassToGeoJSON(data.elements || [], layer);
}
