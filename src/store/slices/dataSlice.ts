import type { StateCreator } from 'zustand';
import type { ElevationGrid, DEMMetadata } from '@/types/dem';
import type { FeatureCollection } from 'geojson';

export interface DataSlice {
  elevationGrid: ElevationGrid | null;
  demMetadata: DEMMetadata | null;
  osmBuildings: FeatureCollection | null;
  osmRoads: FeatureCollection | null;
  osmWater: FeatureCollection | null;
  osmLanduse: FeatureCollection | null;
  osmInfra: FeatureCollection | null;
  contourLines: FeatureCollection | null;
  setElevationGrid: (grid: ElevationGrid, metadata: DEMMetadata) => void;
  setOsmData: (layer: string, data: FeatureCollection) => void;
  setContourLines: (lines: FeatureCollection) => void;
  clearAllData: () => void;
}

export const createDataSlice: StateCreator<DataSlice> = (set) => ({
  elevationGrid: null,
  demMetadata: null,
  osmBuildings: null,
  osmRoads: null,
  osmWater: null,
  osmLanduse: null,
  osmInfra: null,
  contourLines: null,

  setElevationGrid: (grid: ElevationGrid, metadata: DEMMetadata) => {
    set({ elevationGrid: grid, demMetadata: metadata });
  },

  setOsmData: (layer: string, data: FeatureCollection) => {
    switch (layer) {
      case 'buildings': set({ osmBuildings: data }); break;
      case 'roads': set({ osmRoads: data }); break;
      case 'water': set({ osmWater: data }); break;
      case 'landuse': set({ osmLanduse: data }); break;
      case 'infrastructure': set({ osmInfra: data }); break;
    }
  },

  setContourLines: (lines: FeatureCollection) => {
    set({ contourLines: lines });
  },

  clearAllData: () => {
    set({
      elevationGrid: null,
      demMetadata: null,
      osmBuildings: null,
      osmRoads: null,
      osmWater: null,
      osmLanduse: null,
      osmInfra: null,
      contourLines: null,
    });
  },
});
