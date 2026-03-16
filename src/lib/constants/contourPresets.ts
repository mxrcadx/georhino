export const CONTOUR_INTERVALS = [
  { value: 0.5, label: '0.5m (~1.6\')' },
  { value: 1, label: '1m (~3.3\')' },
  { value: 2, label: '2m (~6.6\')' },
  { value: 3, label: '3m (~10\')' },
  { value: 5, label: '5m (~16\')' },
  { value: 10, label: '10m (~33\')' },
  { value: 15, label: '15m (~49\')' },
  { value: 20, label: '20m (~66\')' },
  { value: 25, label: '25m (~82\')' },
  { value: 40, label: '40m (~131\')' },
  { value: 50, label: '50m (~164\')' },
  { value: 100, label: '100m (~328\')' },
  { value: 200, label: '200m (~656\')' },
  { value: 250, label: '250m (~820\')' },
  { value: 500, label: '500m (~1640\')' },
];

export function recommendContourInterval(
  elevationRange: number,
  areaSqKm: number,
  sheetAreaSqIn: number
): { interval: number; reason: string } {
  // Target roughly 50-200 contour lines for readability
  const targetLines = 120;
  const roughInterval = elevationRange / targetLines;

  const standards = [0.5, 1, 2, 3, 5, 10, 15, 20, 25, 40, 50, 100, 200, 250, 500];
  let best = standards[0];
  for (const s of standards) {
    if (s >= roughInterval) {
      best = s;
      break;
    }
    best = s;
  }

  // Adjust for area size — larger areas need bigger intervals
  if (areaSqKm > 100_000 && best < 100) {
    best = 100;
  } else if (areaSqKm > 10_000 && best < 50) {
    best = 50;
  } else if (areaSqKm > 500 && best < 20) {
    best = 20;
  } else if (areaSqKm > 100 && best < 10) {
    best = 10;
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
