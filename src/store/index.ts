import { create, type StateCreator } from 'zustand';
import { createAreaSlice, type AreaSlice } from './slices/areaSlice';
import { createSheetSlice, type SheetSlice } from './slices/sheetSlice';
import { createLayerSlice, type LayerSlice } from './slices/layerSlice';
import { createContourSlice, type ContourSlice } from './slices/contourSlice';
import { createStyleSlice, type StyleSlice } from './slices/styleSlice';
import { createDataSlice, type DataSlice } from './slices/dataSlice';
import { createExportSlice, type ExportSlice } from './slices/exportSlice';

export type AppStore = AreaSlice & SheetSlice & LayerSlice & ContourSlice & StyleSlice & DataSlice & ExportSlice & {
  currentStep: number;
  setCurrentStep: (step: number) => void;
};

export const useAppStore = create<AppStore>()((set, get, store) => ({
  ...(createAreaSlice as StateCreator<AreaSlice>)(
    set as Parameters<StateCreator<AreaSlice>>[0],
    get as Parameters<StateCreator<AreaSlice>>[1],
    store as Parameters<StateCreator<AreaSlice>>[2]
  ),
  ...(createSheetSlice as StateCreator<SheetSlice>)(
    set as Parameters<StateCreator<SheetSlice>>[0],
    get as Parameters<StateCreator<SheetSlice>>[1],
    store as Parameters<StateCreator<SheetSlice>>[2]
  ),
  ...(createLayerSlice as StateCreator<LayerSlice>)(
    set as Parameters<StateCreator<LayerSlice>>[0],
    get as Parameters<StateCreator<LayerSlice>>[1],
    store as Parameters<StateCreator<LayerSlice>>[2]
  ),
  ...(createContourSlice as StateCreator<ContourSlice>)(
    set as Parameters<StateCreator<ContourSlice>>[0],
    get as Parameters<StateCreator<ContourSlice>>[1],
    store as Parameters<StateCreator<ContourSlice>>[2]
  ),
  ...(createStyleSlice as StateCreator<StyleSlice>)(
    set as Parameters<StateCreator<StyleSlice>>[0],
    get as Parameters<StateCreator<StyleSlice>>[1],
    store as Parameters<StateCreator<StyleSlice>>[2]
  ),
  ...(createDataSlice as StateCreator<DataSlice>)(
    set as Parameters<StateCreator<DataSlice>>[0],
    get as Parameters<StateCreator<DataSlice>>[1],
    store as Parameters<StateCreator<DataSlice>>[2]
  ),
  ...(createExportSlice as StateCreator<ExportSlice>)(
    set as Parameters<StateCreator<ExportSlice>>[0],
    get as Parameters<StateCreator<ExportSlice>>[1],
    store as Parameters<StateCreator<ExportSlice>>[2]
  ),
  currentStep: 1,
  setCurrentStep: (step: number) => set({ currentStep: step }),
}));

// Expose store for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__APP_STORE = useAppStore;
}
