declare module '@mapbox/mapbox-gl-draw' {
  import type { Map, IControl } from 'mapbox-gl';

  interface DrawOptions {
    displayControlsDefault?: boolean;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    defaultMode?: string;
    modes?: Record<string, any>;
  }

  class MapboxDraw implements IControl {
    constructor(options?: DrawOptions);
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    getAll(): GeoJSON.FeatureCollection;
    add(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection): string[];
    get(id: string): GeoJSON.Feature | undefined;
    delete(ids: string | string[]): this;
    deleteAll(): this;
    set(featureCollection: GeoJSON.FeatureCollection): string[];
    trash(): this;
    changeMode(mode: string, options?: any): this;
    getMode(): string;
    getSelectedIds(): string[];
    getSelectedPoints(): GeoJSON.FeatureCollection;
    getSelected(): GeoJSON.FeatureCollection;
    setFeatureProperty(featureId: string, property: string, value: any): this;
  }

  export default MapboxDraw;
}

declare module '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css' {
  const content: string;
  export default content;
}
