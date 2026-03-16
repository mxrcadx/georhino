import type { StateCreator } from 'zustand';

export type SheetPreset = '36x36' | '24x36' | '36x48' | 'custom';

export interface SheetSlice {
  sheetPreset: SheetPreset;
  sheetWidthInches: number;
  sheetHeightInches: number;
  scale: number;
  scaleLabel: string;
  isAutoScale: boolean;
  scaleWarning: string | null;
  setSheetPreset: (preset: SheetPreset) => void;
  setCustomSheetSize: (width: number, height: number) => void;
  setScale: (scale: number) => void;
  setScaleManual: (scale: number) => void;
  setAutoScale: (auto: boolean) => void;
  setScaleWarning: (warning: string | null) => void;
}

const PRESETS: Record<string, { w: number; h: number }> = {
  '36x36': { w: 36, h: 36 },
  '24x36': { w: 24, h: 36 },
  '36x48': { w: 36, h: 48 },
};

function makeScaleLabel(scaleDenom: number): string {
  const feetPerInch = scaleDenom / 12;
  if (feetPerInch >= 1000) {
    return `1" = ${feetPerInch.toLocaleString()}'`;
  }
  return `1" = ${Math.round(feetPerInch)}'`;
}

export const createSheetSlice: StateCreator<SheetSlice> = (set) => ({
  sheetPreset: '24x36',
  sheetWidthInches: 24,
  sheetHeightInches: 36,
  scale: 1200,
  scaleLabel: '1" = 100\'',
  isAutoScale: true,
  scaleWarning: null,

  setSheetPreset: (preset: SheetPreset) => {
    if (preset === 'custom') {
      set({ sheetPreset: preset });
    } else {
      const { w, h } = PRESETS[preset];
      set({
        sheetPreset: preset,
        sheetWidthInches: w,
        sheetHeightInches: h,
      });
    }
  },

  setCustomSheetSize: (width: number, height: number) => {
    set({
      sheetPreset: 'custom',
      sheetWidthInches: width,
      sheetHeightInches: height,
    });
  },

  // Auto-scale sets value without turning off auto mode
  setScale: (scale: number) => {
    set({ scale, scaleLabel: makeScaleLabel(scale) });
  },

  // Manual override turns off auto mode
  setScaleManual: (scale: number) => {
    set({ scale, scaleLabel: makeScaleLabel(scale), isAutoScale: false });
  },

  setAutoScale: (auto: boolean) => {
    set({ isAutoScale: auto });
  },

  setScaleWarning: (warning: string | null) => {
    set({ scaleWarning: warning });
  },
});
