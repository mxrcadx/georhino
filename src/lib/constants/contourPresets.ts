export const CONTOUR_INTERVALS = [
  { value: 1, label: '1m' },
  { value: 2, label: '2m' },
  { value: 5, label: '5m' },
  { value: 10, label: '10m' },
  { value: 20, label: '20m' },
  { value: 50, label: '50m' },
];

export function recommendContourInterval(
  elevationRange: number,
  areaSqKm: number,
  sheetAreaSqIn: number
): { interval: number; reason: string } {
  // Target roughly 50-200 contour lines for readability
  const targetLines = 120;
  const roughInterval = elevationRange / targetLines;

  const standards = [1, 2, 5, 10, 20, 50, 100];
  let best = standards[0];
  for (const s of standards) {
    if (s >= roughInterval) {
      best = s;
      break;
    }
    best = s;
  }

  // Adjust for area size
  if (areaSqKm > 100 && best < 10) {
    best = 10;
  }
  if (areaSqKm > 500 && best < 20) {
    best = 20;
  }

  const estimatedLines = Math.floor(elevationRange / best) * 3;
  const reason = `${best}m intervals will produce approximately ${estimatedLines} lines for ${Math.round(elevationRange)}m of relief over ${areaSqKm.toFixed(1)} km²`;

  return { interval: best, reason };
}

export function estimateContourLineCount(
  elevationRange: number,
  interval: number,
  areaSqKm: number
): number {
  const numThresholds = Math.floor(elevationRange / interval);
  // Rough multiplier: more area = more lines per threshold
  const areaMultiplier = Math.max(1, Math.sqrt(areaSqKm / 10));
  return Math.round(numThresholds * areaMultiplier * 2.5);
}

export function getContourDensityWarning(
  lineCount: number,
  sheetWidthInches: number,
  sheetHeightInches: number
): string | null {
  const sheetArea = sheetWidthInches * sheetHeightInches;
  const linesPerSqInch = lineCount / sheetArea;

  if (linesPerSqInch > 3) {
    return `This will produce approximately ${lineCount.toLocaleString()} lines, which will be very dense at this print size. Consider a larger interval for readability.`;
  }
  if (linesPerSqInch > 1.5) {
    return `${lineCount.toLocaleString()} contour lines at this scale may appear dense. Consider increasing the interval.`;
  }
  return null;
}
