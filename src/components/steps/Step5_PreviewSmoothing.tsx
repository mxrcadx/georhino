'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/Badge';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { ARCH_COLORS } from '@/lib/preview/colors';
import { renderPreviewSvg, renderSampleSvg } from '@/lib/preview/renderer';

export function Step5PreviewSmoothing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);

  // The smoothing value that's currently rendered in the full preview
  const [renderedSmoothing, setRenderedSmoothing] = useState<number | null>(null);
  const [isRendering, setIsRendering] = useState(false);

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

  // Full preview — only re-renders when renderedSmoothing changes (via button click)
  const svgContent = useMemo(() => {
    if (!bbox || renderedSmoothing === null) return null;
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
      smoothing: renderedSmoothing,
    });
  }, [bbox, sheetWidthInches, sheetHeightInches, scale, enabledLayers, contourLines, osmBuildings, osmRoads, osmWater, osmLanduse, osmInfra, renderedSmoothing]);

  // Sample preview — updates LIVE with slider, renders only ~20 contour lines in a small box
  const sampleSvg = useMemo(() => {
    if (!bbox || !contourLines) return '';
    return renderSampleSvg({
      bbox,
      contourLines,
      smoothing,
      scale,
    });
  }, [bbox, contourLines, smoothing, scale]);

  const needsRender = renderedSmoothing === null || renderedSmoothing !== smoothing;

  const handleRenderPreview = useCallback(() => {
    setIsRendering(true);
    // Use setTimeout so the UI can show "Rendering..." before the heavy computation
    setTimeout(() => {
      setRenderedSmoothing(smoothing);
      setIsRendering(false);
    }, 50);
  }, [smoothing]);

  // Auto-render on first mount
  const hasAutoRendered = useRef(false);
  if (!hasAutoRendered.current && bbox && renderedSmoothing === null) {
    hasAutoRendered.current = true;
    setTimeout(() => setRenderedSmoothing(smoothing), 100);
  }

  const aspectRatio = sheetWidthInches / sheetHeightInches;

  // The SVG base size in pixels (10px per inch)
  const baseSvgWidth = sheetWidthInches * 10;
  const baseSvgHeight = sheetHeightInches * 10;

  // Calculate fit zoom to fill the container (with padding)
  const calcFitZoom = useCallback(() => {
    if (!containerRef.current) return 1;
    const containerW = containerRef.current.clientWidth - 64; // 32px padding each side
    const containerH = containerRef.current.clientHeight - 64;
    if (containerW <= 0 || containerH <= 0) return 1;

    const scaleX = containerW / baseSvgWidth;
    const scaleY = containerH / baseSvgHeight;
    return Math.min(scaleX, scaleY);
  }, [baseSvgWidth, baseSvgHeight]);

  // Auto-fit on mount and resize
  useEffect(() => {
    const fit = calcFitZoom();
    setFitZoom(fit);
    setZoom(fit);

    const handleResize = () => {
      const newFit = calcFitZoom();
      setFitZoom(newFit);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calcFitZoom]);

  const handleFit = useCallback(() => {
    const fit = calcFitZoom();
    setFitZoom(fit);
    setZoom(fit);
  }, [calcFitZoom]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-2 bg-geo-surface border-b border-geo-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs text-geo-text-muted">Preview</span>
          <Badge variant="neutral">{sheetWidthInches}&quot; × {sheetHeightInches}&quot;</Badge>
          <Badge variant="neutral">{scaleLabel}</Badge>
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
              className="bg-white shadow-2xl"
              style={{
                width: `${sheetWidthInches * 10}px`,
                aspectRatio: `${aspectRatio}`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div className="text-center">
              <p className="text-sm text-geo-text-muted mb-2">
                {isRendering ? 'Rendering preview...' : 'No preview yet'}
              </p>
              <p className="text-xs text-geo-text-muted">
                {isRendering
                  ? 'Smoothing and projecting all contour lines...'
                  : 'Adjust smoothing below, then click "Render Preview" to see the full sheet.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Smoothing sidebar */}
        <div className="w-72 bg-geo-surface border-l border-geo-border p-4 space-y-4 overflow-y-auto shrink-0">
          <div>
            <h3 className="text-sm font-semibold mb-1">Contour Smoothing</h3>
            <p className="text-[10px] text-geo-text-muted">
              Drag the slider to adjust. The sample below updates live. Click &quot;Render Preview&quot; to apply to the full sheet.
            </p>
          </div>

          <Slider
            label="Smoothing"
            value={smoothing * 100}
            onChange={(v) => setSmoothing(v / 100)}
            min={0}
            max={100}
            step={5}
            valueLabel={`${Math.round(smoothing * 100)}%`}
          />
          <div className="flex justify-between text-[10px] text-geo-text-muted -mt-2">
            <span>Raw</span>
            <span>Smooth</span>
          </div>

          {/* Live sample preview */}
          <div>
            <h3 className="text-xs font-medium mb-2 text-geo-text-muted uppercase tracking-wider">
              Live Sample
            </h3>
            <div
              className="w-full aspect-square rounded-lg overflow-hidden border border-geo-border"
              dangerouslySetInnerHTML={{ __html: sampleSvg }}
            />
            <p className="text-[10px] text-geo-text-muted mt-1 text-center">
              ~20 contour lines at current smoothing
            </p>
          </div>

          {/* Render button */}
          <Button
            variant="primary"
            onClick={handleRenderPreview}
            disabled={isRendering || !needsRender}
          >
            {isRendering
              ? 'Rendering...'
              : needsRender
                ? 'Render Preview'
                : 'Preview Up to Date'
            }
          </Button>
          {needsRender && renderedSmoothing !== null && (
            <p className="text-[10px] text-geo-accent text-center -mt-2">
              Preview shows {Math.round(renderedSmoothing * 100)}% — slider is at {Math.round(smoothing * 100)}%
            </p>
          )}

          {/* Layer legend */}
          <div>
            <h3 className="text-xs font-medium mb-2 text-geo-text-muted uppercase tracking-wider">Layers</h3>
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
