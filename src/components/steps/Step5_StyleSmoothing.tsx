'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store';
import { Card } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { smoothContourLine } from '@/lib/contour/smoother';

export function Step5StyleSmoothing() {
  const smoothing = useAppStore((s) => s.smoothing);
  const setSmoothing = useAppStore((s) => s.setSmoothing);
  const contourLines = useAppStore((s) => s.contourLines);

  // Get a sample contour for live preview
  const sampleContour = useMemo(() => {
    if (!contourLines || contourLines.features.length === 0) {
      // Generate a sample contour for demonstration
      const pts: [number, number][] = [];
      for (let i = 0; i <= 20; i++) {
        const t = (i / 20) * Math.PI * 2;
        pts.push([
          150 + Math.cos(t) * 80 + Math.sin(t * 3) * 20 + Math.cos(t * 5) * 8,
          150 + Math.sin(t) * 60 + Math.cos(t * 2) * 15 + Math.sin(t * 7) * 5,
        ]);
      }
      return pts;
    }

    // Pick a mid-length contour for representative preview
    const features = contourLines.features
      .filter((f) => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString');
    if (features.length === 0) return null;

    const sorted = [...features].sort((a, b) => {
      const aLen = (a.geometry as any).coordinates?.length || 0;
      const bLen = (b.geometry as any).coordinates?.length || 0;
      return aLen - bLen;
    });
    const mid = sorted[Math.floor(sorted.length / 2)];
    const coords = (mid.geometry as any).coordinates as [number, number][];

    // Normalize to SVG viewport
    if (!coords || coords.length < 3) return null;
    const minX = Math.min(...coords.map((c) => c[0]));
    const maxX = Math.max(...coords.map((c) => c[0]));
    const minY = Math.min(...coords.map((c) => c[1]));
    const maxY = Math.max(...coords.map((c) => c[1]));
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    return coords.map(([x, y]) => [
      20 + ((x - minX) / rangeX) * 260,
      20 + ((y - minY) / rangeY) * 160,
    ] as [number, number]);
  }, [contourLines]);

  const smoothedContour = useMemo(() => {
    if (!sampleContour) return null;
    return smoothContourLine(sampleContour, smoothing);
  }, [sampleContour, smoothing]);

  const originalPath = sampleContour
    ? `M ${sampleContour.map(([x, y]) => `${x},${y}`).join(' L ')}`
    : '';

  const smoothedPath = smoothedContour
    ? `M ${smoothedContour.map(([x, y]) => `${x},${y}`).join(' L ')}`
    : '';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Style & Smoothing</h2>
          <p className="text-sm text-geo-text-muted">
            Adjust contour line smoothing. Buildings, roads, and other data retain original geometry.
          </p>
        </div>

        {/* Smoothing Slider */}
        <Card>
          <Slider
            label="Contour Smoothing"
            value={smoothing * 100}
            onChange={(v) => setSmoothing(v / 100)}
            min={0}
            max={100}
            step={1}
            valueLabel={`${Math.round(smoothing * 100)}%`}
          />
          <div className="flex justify-between text-[10px] text-geo-text-muted mt-1">
            <span>Raw angular geometry</span>
            <span>Maximum B-spline smoothing</span>
          </div>
        </Card>

        {/* Live Preview */}
        <Card>
          <h3 className="text-sm font-medium mb-3">Contour Preview</h3>
          <div className="bg-geo-bg rounded-lg p-4">
            <svg viewBox="0 0 300 200" className="w-full h-48">
              {/* Original (faded) */}
              {originalPath && (
                <path
                  d={originalPath}
                  fill="none"
                  stroke="#D2B48C"
                  strokeWidth="1"
                  opacity="0.3"
                  strokeDasharray="4 2"
                />
              )}
              {/* Smoothed */}
              {smoothedPath && (
                <path
                  d={smoothedPath}
                  fill="none"
                  stroke="#8B4513"
                  strokeWidth="1.5"
                />
              )}
            </svg>
            <div className="flex items-center gap-4 mt-2 text-xs text-geo-text-muted">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-px border-t border-dashed" style={{ borderColor: '#D2B48C' }} />
                <span>Original</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-px" style={{ backgroundColor: '#8B4513' }} />
                <span>Smoothed ({Math.round(smoothing * 100)}%)</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
