export interface SheetSize {
  id: string;
  label: string;
  widthInches: number;
  heightInches: number;
}

export const SHEET_PRESETS: SheetSize[] = [
  { id: '36x36', label: '36" × 36"', widthInches: 36, heightInches: 36 },
  { id: '24x36', label: '24" × 36" (ARCH D)', widthInches: 24, heightInches: 36 },
  { id: '36x48', label: '36" × 48" (ARCH E)', widthInches: 36, heightInches: 48 },
];

export const SCALE_PRESETS = [
  { value: 120, label: '1" = 10\'' },
  { value: 240, label: '1" = 20\'' },
  { value: 480, label: '1" = 40\'' },
  { value: 600, label: '1" = 50\'' },
  { value: 1200, label: '1" = 100\'' },
  { value: 2400, label: '1" = 200\'' },
  { value: 4800, label: '1" = 400\'' },
  { value: 6000, label: '1" = 500\'' },
  { value: 12000, label: '1" = 1,000\'' },
  { value: 24000, label: '1" = 2,000\'' },
  { value: 48000, label: '1" = 4,000\'' },
  { value: 60000, label: '1" = 5,000\'' },
  { value: 120000, label: '1" = 10,000\'' },
];

export function getScaleLabel(scaleDenom: number): string {
  const feetPerInch = scaleDenom / 12;
  if (feetPerInch >= 1000) {
    return `1" = ${(feetPerInch / 1000).toFixed(1)}k'`;
  }
  return `1" = ${Math.round(feetPerInch)}'`;
}

export function autoCalculateScale(
  siteWidthFeet: number,
  siteHeightFeet: number,
  sheetWidthInches: number,
  sheetHeightInches: number
): number {
  const marginInches = 2;
  const usableWidth = sheetWidthInches - marginInches * 2;
  const usableHeight = sheetHeightInches - marginInches * 2;

  const scaleByWidth = (siteWidthFeet / usableWidth) * 12;
  const scaleByHeight = (siteHeightFeet / usableHeight) * 12;
  const rawScale = Math.max(scaleByWidth, scaleByHeight);

  // Snap to nearest standard scale (must fit on sheet)
  const standards = [120, 240, 480, 600, 1200, 2400, 4800, 6000, 12000, 24000, 48000, 60000, 120000];
  for (const s of standards) {
    if (s >= rawScale) {
      return s;
    }
  }
  return standards[standards.length - 1];
}
