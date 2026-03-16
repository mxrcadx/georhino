import proj4 from 'proj4';
import type { BoundingBox, Projector } from '@/types/geo';
import type { FeatureCollection, Feature, Geometry, Position } from 'geojson';

const M_TO_FT = 3.28084;

export function getUtmZone(longitude: number): number {
  return Math.floor((longitude + 180) / 6) + 1;
}

export function createProjector(
  zone: number,
  hemisphere: 'N' | 'S',
  bbox: BoundingBox
): Projector {
  const utmDef = `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south' : 'north'} +datum=WGS84 +units=m +no_defs`;

  const centerLng = (bbox.east + bbox.west) / 2;
  const centerLat = (bbox.north + bbox.south) / 2;
  const [originE, originN] = proj4('EPSG:4326', utmDef, [centerLng, centerLat]);

  return {
    forward: ([lng, lat]: [number, number]): [number, number] => {
      const [e, n] = proj4('EPSG:4326', utmDef, [lng, lat]);
      return [(e - originE) * M_TO_FT, (n - originN) * M_TO_FT];
    },
    inverse: ([fx, fy]: [number, number]): [number, number] => {
      const e = fx / M_TO_FT + originE;
      const n = fy / M_TO_FT + originN;
      return proj4(utmDef, 'EPSG:4326', [e, n]);
    },
    originEasting: originE,
    originNorthing: originN,
    zone,
    hemisphere,
  };
}

function projectPosition(pos: Position, projector: Projector): Position {
  const [x, y] = projector.forward([pos[0], pos[1]]);
  if (pos.length > 2) {
    return [x, y, pos[2] * M_TO_FT]; // Convert elevation to feet too
  }
  return [x, y];
}

function projectCoordinates(coords: any, projector: Projector): any {
  if (typeof coords[0] === 'number') {
    return projectPosition(coords as Position, projector);
  }
  return coords.map((c: any) => projectCoordinates(c, projector));
}

function projectGeometry(geometry: Geometry, projector: Projector): Geometry {
  switch (geometry.type) {
    case 'Point':
      return { type: 'Point', coordinates: projectPosition(geometry.coordinates, projector) };
    case 'LineString':
    case 'MultiPoint':
      return { type: geometry.type, coordinates: projectCoordinates(geometry.coordinates, projector) };
    case 'Polygon':
    case 'MultiLineString':
      return { type: geometry.type, coordinates: projectCoordinates(geometry.coordinates, projector) };
    case 'MultiPolygon':
      return { type: 'MultiPolygon', coordinates: projectCoordinates(geometry.coordinates, projector) };
    default:
      return geometry;
  }
}

export function projectFeatureCollection(
  fc: FeatureCollection | null,
  projector: Projector
): FeatureCollection | null {
  if (!fc) return null;

  return {
    type: 'FeatureCollection',
    features: fc.features.map((feature): Feature => ({
      ...feature,
      geometry: projectGeometry(feature.geometry, projector),
    })),
  };
}
