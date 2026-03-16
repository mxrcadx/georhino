export type ExportFormat = 'dxf' | 'svg' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  sheetWidthInches: number;
  sheetHeightInches: number;
  scale: number;
  is3D: boolean;
}

export interface DxfLayerDef {
  name: string;
  color: number;
  linetype: string;
}
