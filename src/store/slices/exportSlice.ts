import type { StateCreator } from 'zustand';
import type { ExportFormat } from '@/types/export';

export interface ExportSlice {
  exportFormat: ExportFormat;
  exportProgress: number;
  isExporting: boolean;
  exportError: string | null;
  estimatedFileSize: string | null;
  setExportFormat: (format: ExportFormat) => void;
  setExportProgress: (progress: number) => void;
  setIsExporting: (val: boolean) => void;
  setExportError: (error: string | null) => void;
  setEstimatedFileSize: (size: string | null) => void;
}

export const createExportSlice: StateCreator<ExportSlice> = (set) => ({
  exportFormat: 'dxf',
  exportProgress: 0,
  isExporting: false,
  exportError: null,
  estimatedFileSize: null,

  setExportFormat: (format: ExportFormat) => set({ exportFormat: format }),
  setExportProgress: (progress: number) => set({ exportProgress: progress }),
  setIsExporting: (val: boolean) => set({ isExporting: val }),
  setExportError: (error: string | null) => set({ exportError: error }),
  setEstimatedFileSize: (size: string | null) => set({ estimatedFileSize: size }),
});
