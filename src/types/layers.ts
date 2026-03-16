export type LayerName = 'contours' | 'buildings' | 'roads' | 'water' | 'landuse' | 'infrastructure';

export type LayerFetchStatus = 'idle' | 'fetching' | 'success' | 'error' | 'no-data';

export interface LayerDefinition {
  name: LayerName;
  label: string;
  description: string;
  source: string;
  dxfLayers: string[];
  color: string;
  icon: string;
}
