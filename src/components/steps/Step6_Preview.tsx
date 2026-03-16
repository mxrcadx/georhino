'use client';

import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ARCH_COLORS } from '@/lib/preview/colors';
import { renderPreviewSvg } from '@/lib/preview/renderer';

export function Step6Preview() {
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

  const aspectRatio = sheetWidthInches / sheetHeightInches;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-2 bg-geo-surface border-b border-geo-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs text-geo-text-muted">Preview</span>
          <Badge variant="neutral">{sheetWidthInches}" × {sheetHeightInches}"</Badge>
          <Badge variant="neutral">{scaleLabel}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="px-2 py-1 text-xs bg-geo-border rounded hover:bg-geo-border-hover">
            -
          </button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="px-2 py-1 text-xs bg-geo-border rounded hover:bg-geo-border-hover">
            +
          </button>
          <button onClick={() => setZoom(1)} className="px-2 py-1 text-xs bg-geo-border rounded hover:bg-geo-border-hover ml-1">
            Fit
          </button>
        </div>
      </div>

      {/* Preview canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-geo-bg flex items-center justify-center p-8"
      >
        {svgContent ? (
          <div
            className="bg-white shadow-2xl"
            style={{
              width: `${sheetWidthInches * 10 * zoom}px`,
              aspectRatio: `${aspectRatio}`,
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="text-center">
            <p className="text-sm text-geo-text-muted mb-2">No data to preview</p>
            <p className="text-xs text-geo-text-muted">
              Go back to Step 3 to fetch data layers, then return here.
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-geo-surface border-t border-geo-border flex items-center gap-6 shrink-0">
        {Object.entries(ARCH_COLORS).slice(0, 6).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px] text-geo-text-muted">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
