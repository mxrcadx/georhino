'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/Badge';
import { Slider } from '@/components/ui/Slider';
import { ARCH_COLORS } from '@/lib/preview/colors';
import { renderPreviewSvg } from '@/lib/preview/renderer';

export function Step5PreviewSmoothing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const sheetWidthInches = useAppStore((s) => s.sheetWidthInches);
  const sheetHeightInches = useAppStore((s) => s.sheetHeightInches);
  const scale = useAppStore((s) => s.scale);
  const scaleLabel = useAppStore((s) => s.scaleLabel);
  const bbox = useAppStore((s) => s.bbox);
  const enabledLayers = useAppStore((s) => s.enabledLayers);
  const contourLines = useAppStore((s) => s.contourLines);
  const osmBuildings = useAppStore((s) => s.osmBuildings);
  const osmRoads = useAppStore((s) => s.osmRoads);
  const osmWater = useAppStore((s) => s.osmWater);
  const osmLanduse = useAppStore((s) => s.osmLanduse);
  const osmInfra = useAppStore((s) => s.osmInfra);
  const smoothing = useAppStore((s) => s.smoothing);
  const setSmoothing = useAppStore((s) => s.setSmoothing);

  // Count points for display
  const pointStats = useMemo(() => {
    if (!contourLines) return null;
    const lineCount = contourLines.features.length;
    let totalPoints = 0;
    let maxPoints = 0;
    for (const f of contourLines.features) {
      if (f.geometry.type === 'LineString') {
        const len = f.geometry.coordinates.length;
        totalPoints += len;
        if (len > maxPoints) maxPoints = len;
      }
    }
    return { lineCount, totalPoints, maxPoints };
  }, [contourLines]);

  // Preview renders directly with current smoothing — no button needed
  // since smoothing is now pure simplification (fast, no point addition)
  const svgContent = useMemo(() => {
    if (!bbox) return null;
    return renderPreviewSvg({
      bbox,
      sheetWidthInches,
      sheetHeightInches,
      scale,
      enabledLayers,
      contourLines,
      osmBuildings,
      osmRoads,
      osmWater,
      osmLanduse,
      osmInfra,
      smoothing,
    });
  }, [bbox, sheetWidthInches, sheetHeightInches, scale, enabledLayers, contourLines, osmBuildings, osmRoads, osmWater, osmLanduse, osmInfra, smoothing]);

  // The SVG base size in pixels (10px per inch)
  const baseSvgWidth = sheetWidthInches * 10;
  const baseSvgHeight = sheetHeightInches * 10;

  // Calculate fit zoom to fill the container (with padding)
  const calcFitZoom = useCallback(() => {
    if (!containerRef.current) return 1;
    const containerW = containerRef.current.clientWidth - 64;
    const containerH = containerRef.current.clientHeight - 64;
    if (containerW <= 0 || containerH <= 0) return 1;

    const scaleX = containerW / baseSvgWidth;
    const scaleY = containerH / baseSvgHeight;
    return Math.min(scaleX, scaleY);
  }, [baseSvgWidth, baseSvgHeight]);

  // Auto-fit on mount and resize
  useEffect(() => {
    const fit = calcFitZoom();
    setZoom(fit);

    const handleResize = () => {
      const newFit = calcFitZoom();
      setZoom(newFit);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calcFitZoom]);

  const handleFit = useCallback(() => {
    setZoom(calcFitZoom());
  }, [calcFitZoom]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-2 bg-geo-surface border-b border-geo-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs text-geo-text-muted">Preview</span>
          <Badge variant="neutral">{sheetWidthInches}&quot; × {sheetHeightInches}&quot;</Badge>
          <Badge variant="neutral">{scaleLabel}</Badge>
          {pointStats && (
            <Badge variant="neutral">{pointStats.lineCount} lines</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.25, z * 0.8))} className="px-2 py-1 text-xs bg-geo-border rounded hover:bg-geo-border-hover">
            -
          </button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(10, z * 1.25))} className="px-2 py-1 text-xs bg-geo-border rounded hover:bg-geo-border-hover">
            +
          </button>
          <button onClick={handleFit} className="px-2 py-1 text-xs bg-geo-border rounded hover:bg-geo-border-hover ml-1">
            Fit
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Preview canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-geo-bg flex items-center justify-center p-8"
        >
          {svgContent ? (
            <div
              className="bg-white shadow-2xl shrink-0"
              style={{
                width: `${baseSvgWidth * zoom}px`,
                height: `${baseSvgHeight * zoom}px`,
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div className="text-center">
              <p className="text-sm text-geo-text-muted mb-2">No preview available</p>
              <p className="text-xs text-geo-text-muted">
                Go back to earlier steps and fetch data to see a preview.
              </p>
            </div>
          )}
        </div>

        {/* Smoothing sidebar */}
        <div className="w-64 bg-geo-surface border-l border-geo-border p-4 space-y-5 overflow-y-auto shrink-0">
          <div>
            <h3 className="text-sm font-semibold mb-1">Contour Simplification</h3>
            <p className="text-[10px] text-geo-text-muted">
              Higher values remove more points for lighter files. Preview updates live.
            </p>
          </div>

          <Slider
            label="Simplification"
            value={smoothing * 100}
            onChange={(v) => setSmoothing(v / 100)}
            min={0}
            max={100}
            step={5}
            valueLabel={`${Math.round(smoothing * 100)}%`}
          />
          <div className="flex justify-between text-[10px] text-geo-text-muted -mt-3">
            <span>Raw</span>
            <span>Simplified</span>
          </div>

          {/* Point stats */}
          {pointStats && (
            <div className="bg-geo-bg rounded-lg p-3 space-y-1.5">
              <h4 className="text-[10px] font-medium text-geo-text-muted uppercase tracking-wider">Contour Stats</h4>
              <div className="text-xs">
                <div className="flex justify-between">
                  <span className="text-geo-text-muted">Lines</span>
                  <span className="font-mono">{pointStats.lineCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-geo-text-muted">Total points</span>
                  <span className="font-mono">{pointStats.totalPoints.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-geo-text-muted">Max pts/line</span>
                  <span className="font-mono">{pointStats.maxPoints.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Layer legend */}
          <div>
            <h3 className="text-[10px] font-medium mb-2 text-geo-text-muted uppercase tracking-wider">Layers</h3>
            <div className="space-y-1.5">
              {enabledLayers.contours && (
                <>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: ARCH_COLORS.contourMajor }} />
                    <span className="text-geo-text-muted">Major Contour</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: ARCH_COLORS.contourMinor }} />
                    <span className="text-geo-text-muted">Minor Contour</span>
                  </div>
                </>
              )}
              {enabledLayers.buildings && (
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="w-3 h-3 rounded-sm border" style={{ borderColor: ARCH_COLORS.building, backgroundColor: '#E0E0E0' }} />
                  <span className="text-geo-text-muted">Building</span>
                </div>
              )}
              {enabledLayers.roads && (
                <>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: ARCH_COLORS.road }} />
                    <span className="text-geo-text-muted">Highway</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: ARCH_COLORS.roadLocal }} />
                    <span className="text-geo-text-muted">Local Road</span>
                  </div>
                </>
              )}
              {enabledLayers.water && (
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="w-3 h-3 rounded-sm border" style={{ borderColor: ARCH_COLORS.water, backgroundColor: ARCH_COLORS.waterFill }} />
                  <span className="text-geo-text-muted">Water</span>
                </div>
              )}
              {enabledLayers.landuse && (
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: ARCH_COLORS.landuse }} />
                  <span className="text-geo-text-muted">Land Use</span>
                </div>
              )}
              {enabledLayers.infrastructure && (
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: ARCH_COLORS.infrastructure }} />
                  <span className="text-geo-text-muted">Infrastructure</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
