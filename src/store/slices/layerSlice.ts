import type { StateCreator } from 'zustand';
import type { LayerName, LayerFetchStatus } from '@/types/layers';

export interface LayerSlice {
  enabledLayers: Record<LayerName, boolean>;
  fetchStatus: Record<LayerName, LayerFetchStatus>;
  fetchErrors: Record<LayerName, string | null>;
  toggleLayer: (name: LayerName) => void;
  setLayerEnabled: (name: LayerName, enabled: boolean) => void;
  setFetchStatus: (name: LayerName, status: LayerFetchStatus, error?: string) => void;
}

const defaultEnabled: Record<LayerName, boolean> = {
  contours: true,
  buildings: true,
  roads: true,
  water: true,
  landuse: false,
  infrastructure: false,
};

const defaultStatus: Record<LayerName, LayerFetchStatus> = {
  contours: 'idle',
  buildings: 'idle',
  roads: 'idle',
  water: 'idle',
  landuse: 'idle',
  infrastructure: 'idle',
};

const defaultErrors: Record<LayerName, string | null> = {
  contours: null,
  buildings: null,
  roads: null,
  water: null,
  landuse: null,
  infrastructure: null,
};

export const createLayerSlice: StateCreator<LayerSlice> = (set) => ({
  enabledLayers: { ...defaultEnabled },
  fetchStatus: { ...defaultStatus },
  fetchErrors: { ...defaultErrors },

  toggleLayer: (name: LayerName) => {
    set((state) => ({
      enabledLayers: {
        ...state.enabledLayers,
        [name]: !state.enabledLayers[name],
      },
    }));
  },

  setLayerEnabled: (name: LayerName, enabled: boolean) => {
    set((state) => ({
      enabledLayers: {
        ...state.enabledLayers,
        [name]: enabled,
      },
    }));
  },

  setFetchStatus: (name: LayerName, status: LayerFetchStatus, error?: string) => {
    set((state) => ({
      fetchStatus: {
        ...state.fetchStatus,
        [name]: status,
      },
      fetchErrors: {
        ...state.fetchErrors,
        [name]: error ?? null,
      },
    }));
  },
});
