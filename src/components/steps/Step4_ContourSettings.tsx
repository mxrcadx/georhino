'use client';

import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/store';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CONTOUR_INTERVALS, recommendContourInterval, estimateContourLineCount, getContourDensityWarning } from '@/lib/constants/contourPresets';
import { generateContours } from '@/lib/contour/contourGenerator';

export function Step4ContourSettings() {
  const elevationGrid = useAppStore((s) => s.elevationGrid);
  const demMetadata = useAppStore((s) => s.demMetadata);
  const contourInterval = useAppStore((s) => s.contourInterval);
  const majorEvery = useAppStore((s) => s.majorEvery);
  const is3D = useAppStore((s) => s.is3D);
  const estimatedLineCount = useAppStore((s) => s.estimatedLineCount);
  const densityWarning = useAppStore((s) => s.densityWarning);
  const recommendedInterval = useAppStore((s) => s.recommendedInterval);
  const recommendedReason = useAppStore((s) => s.recommendedReason);
  const sheetWidthInches = useAppStore((s) => s.sheetWidthInches);
  const sheetHeightInches = useAppStore((s) => s.sheetHeightInches);
  const areaSqFt = useAppStore((s) => s.areaSqFt);
  const setContourInterval = useAppStore((s) => s.setContourInterval);
  const setMajorEvery = useAppStore((s) => s.setMajorEvery);
  const setIs3D = useAppStore((s) => s.setIs3D);
  const setEstimatedLineCount = useAppStore((s) => s.setEstimatedLineCount);
  const setDensityWarning = useAppStore((s) => s.setDensityWarning);
  const setRecommendedInterval = useAppStore((s) => s.setRecommendedInterval);
  const contourLines = useAppStore((s) => s.contourLines);
  const setContourLines = useAppStore((s) => s.setContourLines);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contourCount, setContourCount] = useState(0);

  // Generate contour lines from elevation grid
  const runContourGeneration = useCallback(() => {
    if (!elevationGrid) return;
    setIsGenerating(true);

    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      try {
        const lines = generateContours(elevationGrid, contourInterval, majorEvery);
        setContourLines(lines);
        setContourCount(lines.features.length);
      } catch (err) {
        console.error('Contour generation failed:', err);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  }, [elevationGrid, contourInterval, majorEvery, setContourLines]);

  // Auto-generate contours when elevation data is first available or settings change
  useEffect(() => {
    if (!elevationGrid) return;
    runContourGeneration();
  }, [elevationGrid, contourInterval, majorEvery, runContourGeneration]);

  // Calculate recommendations when elevation data is available
  useEffect(() => {
    if (!demMetadata) return;
    const elevRange = demMetadata.maxElevation - demMetadata.minElevation;
    const areaSqKm = areaSqFt / 10763910.4; // sqft to sqkm

    const rec = recommendContourInterval(elevRange, areaSqKm, sheetWidthInches * sheetHeightInches);
    setRecommendedInterval(rec.interval, rec.reason);
  }, [demMetadata, areaSqFt, sheetWidthInches, sheetHeightInches, setRecommendedInterval]);

  // Update line count estimate and density warning
  useEffect(() => {
    if (!demMetadata) return;
    const elevRange = demMetadata.maxElevation - demMetadata.minElevation;
    const areaSqKm = areaSqFt / 10763910.4;

    const count = estimateContourLineCount(elevRange, contourInterval, areaSqKm);
    setEstimatedLineCount(count);

    const warning = getContourDensityWarning(count, sheetWidthInches, sheetHeightInches);
    setDensityWarning(warning);
  }, [demMetadata, contourInterval, areaSqFt, sheetWidthInches, sheetHeightInches, setEstimatedLineCount, setDensityWarning]);

  const intervalOptions = [
    ...CONTOUR_INTERVALS.map((ci) => ({ value: String(ci.value), label: ci.label })),
    { value: 'custom', label: 'Custom' },
  ];

  if (!elevationGrid) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h3 className="text-lg font-semibold mb-2">Elevation Data Required</h3>
          <p className="text-sm text-geo-text-muted">
            Go back to Step 3 and fetch contour data to configure contour settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Contour Settings</h2>
          <p className="text-sm text-geo-text-muted">
            Configure contour line generation from the elevation data.
          </p>
        </div>

        {/* Elevation Data Info */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Elevation Data</h3>
            {isGenerating ? (
              <Badge variant="info">Generating contours...</Badge>
            ) : contourLines && contourCount > 0 ? (
              <Badge variant="success">{contourCount.toLocaleString()} contour lines</Badge>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-geo-text-muted text-xs">Source</div>
              <div className="font-mono">{demMetadata?.source}</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Resolution</div>
              <div className="font-mono">{demMetadata?.resolution}</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Elevation Range</div>
              <div className="font-mono">
                {Math.round((demMetadata?.minElevation ?? 0) * 3.28084)}' — {Math.round((demMetadata?.maxElevation ?? 0) * 3.28084)}'
              </div>
            </div>
          </div>
        </Card>

        {/* Contour Interval */}
        <Card>
          <h3 className="text-sm font-medium mb-4">Contour Interval</h3>

          {recommendedInterval && (
            <div className="bg-geo-accent/5 border border-geo-accent/20 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="info">Recommended</Badge>
                <span className="text-sm font-mono font-medium">{recommendedInterval}m</span>
              </div>
              <p className="text-xs text-geo-text-muted">{recommendedReason}</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap mb-4">
            {CONTOUR_INTERVALS.map((ci) => (
              <button
                key={ci.value}
                onClick={() => setContourInterval(ci.value)}
                className={`
                  px-4 py-2 rounded-lg border text-sm font-mono transition-colors
                  ${contourInterval === ci.value
                    ? 'border-geo-accent bg-geo-accent/10 text-geo-accent'
                    : 'border-geo-border hover:border-geo-border-hover text-geo-text-muted'
                  }
                `}
              >
                {ci.label}
              </button>
            ))}
          </div>

          {estimatedLineCount !== null && (
            <div className="text-sm text-geo-text-muted">
              Estimated contour lines: <span className="font-mono font-medium text-geo-text">{estimatedLineCount.toLocaleString()}</span>
            </div>
          )}

          {densityWarning && (
            <div className="mt-3 bg-geo-warning/5 border border-geo-warning/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Badge variant="warning">Dense</Badge>
                <p className="text-xs text-geo-warning">{densityWarning}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Major/Minor */}
        <Card>
          <h3 className="text-sm font-medium mb-3">Major Contours</h3>
          <p className="text-xs text-geo-text-muted mb-3">
            Major contours appear on the TOPO-CONTOUR-MAJOR layer with heavier lineweight.
          </p>
          <Select
            label="Major contour every"
            options={[
              { value: '0', label: 'None' },
              { value: '2', label: 'Every 2nd line' },
              { value: '4', label: 'Every 4th line' },
              { value: '5', label: 'Every 5th line' },
              { value: '10', label: 'Every 10th line' },
              { value: '20', label: 'Every 20th line' },
              { value: '25', label: 'Every 25th line' },
              { value: '50', label: 'Every 50th line' },
              { value: '100', label: 'Every 100th line' },
              { value: '200', label: 'Every 200th line' },
              { value: '500', label: 'Every 500th line' },
            ]}
            value={String(majorEvery)}
            onChange={(v) => setMajorEvery(Number(v))}
          />
          {majorEvery > 0 && (
            <div className="mt-2 text-xs text-geo-text-muted font-mono">
              Major interval: {contourInterval * majorEvery}m ({Math.round(contourInterval * majorEvery * 3.28084)}')
            </div>
          )}
          {majorEvery === 0 && (
            <div className="mt-2 text-xs text-geo-text-muted">
              All contours will be placed on the minor contour layer.
            </div>
          )}
        </Card>

        {/* 3D vs 2D */}
        <Card>
          <h3 className="text-sm font-medium mb-3">Contour Mode</h3>
          <div className="space-y-3">
            <button
              onClick={() => setIs3D(true)}
              className={`
                w-full p-3 rounded-lg border text-left transition-colors
                ${is3D ? 'border-geo-accent bg-geo-accent/5' : 'border-geo-border hover:border-geo-border-hover'}
              `}
            >
              <div className="text-sm font-medium">3D Contours</div>
              <div className="text-xs text-geo-text-muted mt-0.5">
                Polylines at real elevation (z-value in feet). Best for 3D modeling in Rhino.
              </div>
            </button>
            <button
              onClick={() => setIs3D(false)}
              className={`
                w-full p-3 rounded-lg border text-left transition-colors
                ${!is3D ? 'border-geo-accent bg-geo-accent/5' : 'border-geo-border hover:border-geo-border-hover'}
              `}
            >
              <div className="text-sm font-medium">2D Flat Contours</div>
              <div className="text-xs text-geo-text-muted mt-0.5">
                All contours at z=0 with elevation labels as text annotations. Best for 2D drawings and prints.
              </div>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
