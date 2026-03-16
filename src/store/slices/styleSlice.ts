import type { StateCreator } from 'zustand';

export interface StyleSlice {
  smoothing: number;
  setSmoothing: (val: number) => void;
}

export const createStyleSlice: StateCreator<StyleSlice> = (set) => ({
  smoothing: 0.5,
  setSmoothing: (val: number) => set({ smoothing: val }),
});
