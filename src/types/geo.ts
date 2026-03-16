export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface UTMCoord {
  easting: number;
  northing: number;
  zone: number;
  hemisphere: 'N' | 'S';
}

export interface Projector {
  forward: (coord: [number, number]) => [number, number];
  inverse: (coord: [number, number]) => [number, number];
  originEasting: number;
  originNorthing: number;
  zone: number;
  hemisphere: 'N' | 'S';
}
