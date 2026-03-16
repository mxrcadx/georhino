import type { BoundingBox } from './geo';

export interface ElevationGrid {
  data: Float32Array;
  width: number;
  height: number;
  bbox: BoundingBox;
  noDataValue: number;
  resolution: number;
  source: DEMSource;
}

export type DEMSource = 'COP30' | 'COP90' | 'SRTMGL1' | 'USGS10m' | 'USGS30m';

export interface DEMMetadata {
  source: DEMSource;
  resolution: string;
  coverage: 'full' | 'partial' | 'none';
  minElevation: number;
  maxElevation: number;
}
