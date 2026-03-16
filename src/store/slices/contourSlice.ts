import type { StateCreator } from 'zustand';

export interface ContourSlice {
  contourInterval: number;
  customInterval: number | null;
  majorEvery: number;
  is3D: boolean;
  estimatedLineCount: number | null;
  densityWarning: string | null;
  recommendedInterval: number | null;
  recommendedReason: string | null;
  setContourInterval: (interval: number) => void;
  setCustomInterval: (interval: number | null) => void;
  setMajorEvery: (n: number) => void;
  setIs3D: (val: boolean) => void;
  setEstimatedLineCount: (count: number | null) => void;
  setDensityWarning: (warning: string | null) => void;
  setRecommendedInterval: (interval: number | null, reason: string | null) => void;
}

export const createContourSlice: StateCreator<ContourSlice> = (set) => ({
  contourInterval: 10,
  customInterval: null,
  majorEvery: 5,
  is3D: false,
  estimatedLineCount: null,
  densityWarning: null,
  recommendedInterval: null,
  recommendedReason: null,

  setContourInterval: (interval: number) => {
    set({ contourInterval: interval, customInterval: null });
  },

  setCustomInterval: (interval: number | null) => {
    set({
      customInterval: interval,
      contourInterval: interval ?? 10,
    });
  },

  setMajorEvery: (n: number) => {
    set({ majorEvery: n });
  },

  setIs3D: (val: boolean) => {
    set({ is3D: val });
  },

  setEstimatedLineCount: (count: number | null) => {
    set({ estimatedLineCount: count });
  },

  setDensityWarning: (warning: string | null) => {
    set({ densityWarning: warning });
  },

  setRecommendedInterval: (interval: number | null, reason: string | null) => {
    set({ recommendedInterval: interval, recommendedReason: reason });
  },
});
