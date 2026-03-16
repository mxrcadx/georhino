'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { runExportPipeline } from '@/lib/export/exportPipeline';
import type { ExportFormat } from '@/types/export';

const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string; recommended?: boolean }[] = [
  { id: 'dxf', label: 'DXF', desc: 'AutoCAD Drawing Exchange Format. Opens natively in Rhino. Organized layers, real-world coordinates in feet.', recommended: true },
  { id: 'svg', label: 'SVG', desc: 'Scalable Vector Graphics. Ideal for web presentations and digital use.' },
  { id: 'pdf', label: 'PDF', desc: 'Vector PDF at print size. Ready for plotting.' },
];

export function Step7Export() {
  const exportFormat = useAppStore((s) => s.exportFormat);
  const exportProgress = useAppStore((s) => s.exportProgress);
  const isExporting = useAppStore((s) => s.isExporting);
  const exportError = useAppStore((s) => s.exportError);
  const setExportFormat = useAppStore((s) => s.setExportFormat);

  const bbox = useAppStore((s) => s.bbox);
  const sheetWidthInches = useAppStore((s) => s.sheetWidthInches);
  const sheetHeightInches = useAppStore((s) => s.sheetHeightInches);
  const scale = useAppStore((s) => s.scale);
  const scaleLabel = useAppStore((s) => s.scaleLabel);
  const is3D = useAppStore((s) => s.is3D);
  const smoothing = useAppStore((s) => s.smoothing);
  const contourInterval = useAppStore((s) => s.contourInterval);

  const handleExport = useCallback(async () => {
    try {
      await runExportPipeline(useAppStore.getState());
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Export</h2>
          <p className="text-sm text-geo-text-muted">
            Generate your site file. All coordinates are projected to UTM and output in feet.
          </p>
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          {FORMAT_OPTIONS.map((fmt) => (
            <Card
              key={fmt.id}
              active={exportFormat === fmt.id}
              hoverable
              onClick={() => setExportFormat(fmt.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0
                  ${exportFormat === fmt.id ? 'border-geo-accent' : 'border-geo-border'}
                `}>
                  {exportFormat === fmt.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-geo-accent" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{fmt.label}</h3>
                    {fmt.recommended && <Badge variant="info">Recommended</Badge>}
                  </div>
                  <p className="text-xs text-geo-text-muted mt-0.5">{fmt.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* AI and 3DM info */}
        <Card>
          <h3 className="text-sm font-medium mb-2">Other Formats</h3>
          <div className="text-xs text-geo-text-muted space-y-2">
            <p>
              <strong>AI (Adobe Illustrator)</strong> — Open the exported SVG directly in Illustrator for post-processing.
            </p>
            <p>
              <strong>3DM (Rhino native)</strong> — DXF is the recommended format for Rhino. Import the DXF file directly — all layers and geometry will be preserved.
            </p>
          </div>
        </Card>

        {/* Export Summary */}
        <Card>
          <h3 className="text-sm font-medium mb-3">Export Settings Summary</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-geo-text-muted text-xs">Format</div>
              <div className="font-mono uppercase">{exportFormat}</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Sheet Size</div>
              <div className="font-mono">{sheetWidthInches}" × {sheetHeightInches}"</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Scale</div>
              <div className="font-mono">{scaleLabel}</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Contour Mode</div>
              <div className="font-mono">{is3D ? '3D' : '2D Flat'}</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Contour Interval</div>
              <div className="font-mono">{contourInterval}m</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Smoothing</div>
              <div className="font-mono">{Math.round(smoothing * 100)}%</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Units</div>
              <div className="font-mono">Feet</div>
            </div>
            <div>
              <div className="text-geo-text-muted text-xs">Projection</div>
              <div className="font-mono">UTM (auto)</div>
            </div>
          </div>
        </Card>

        {/* Export Button */}
        <div className="space-y-4">
          {isExporting && (
            <ProgressBar progress={exportProgress} label="Generating file..." />
          )}

          {exportError && (
            <div className="bg-geo-error/5 border border-geo-error/20 rounded-lg p-3">
              <p className="text-xs text-geo-error">{exportError}</p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleExport}
            disabled={isExporting || !bbox}
          >
            {isExporting ? 'Generating...' : `Export ${exportFormat.toUpperCase()} File`}
          </Button>
        </div>
      </div>
    </div>
  );
}
