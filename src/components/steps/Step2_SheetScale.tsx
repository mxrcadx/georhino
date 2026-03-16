'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SHEET_PRESETS, SCALE_PRESETS, autoCalculateScale, getScaleLabel } from '@/lib/constants/sheetSizes';

function CustomScaleInput({ scale, setScaleManual }: { scale: number; setScaleManual: (v: number) => void }) {
  const [text, setText] = useState(String(Math.round(scale / 12)));

  // Sync from store → local when store changes externally (preset buttons)
  useEffect(() => {
    setText(String(Math.round(scale / 12)));
  }, [scale]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-geo-text-muted whitespace-nowrap">Custom: 1&quot; =</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, '');
          setText(raw);
          const num = parseInt(raw, 10);
          if (num > 0) {
            setScaleManual(num * 12);
          }
        }}
        className="w-28 bg-geo-bg border border-geo-border rounded-lg px-3 py-1.5 text-sm font-mono text-geo-text"
      />
      <span className="text-xs text-geo-text-muted">feet</span>
    </div>
  );
}

export function Step2SheetScale() {
  const widthFeet = useAppStore((s) => s.widthFeet);
  const heightFeet = useAppStore((s) => s.heightFeet);
  const sheetPreset = useAppStore((s) => s.sheetPreset);
  const sheetWidthInches = useAppStore((s) => s.sheetWidthInches);
  const sheetHeightInches = useAppStore((s) => s.sheetHeightInches);
  const scale = useAppStore((s) => s.scale);
  const scaleLabel = useAppStore((s) => s.scaleLabel);
  const isAutoScale = useAppStore((s) => s.isAutoScale);
  const scaleWarning = useAppStore((s) => s.scaleWarning);
  const setSheetPreset = useAppStore((s) => s.setSheetPreset);
  const setCustomSheetSize = useAppStore((s) => s.setCustomSheetSize);
  const setScale = useAppStore((s) => s.setScale);
  const setScaleManual = useAppStore((s) => s.setScaleManual);
  const setAutoScale = useAppStore((s) => s.setAutoScale);
  const setScaleWarning = useAppStore((s) => s.setScaleWarning);

  // Auto-calculate scale when bbox or sheet size changes
  useEffect(() => {
    if (!isAutoScale || !widthFeet || !heightFeet) return;
    const autoScale = autoCalculateScale(widthFeet, heightFeet, sheetWidthInches, sheetHeightInches);
    setScale(autoScale); // setScale preserves auto mode

    // Check if area fits
    const feetPerInch = autoScale / 12;
    const drawingWidth = widthFeet / feetPerInch;
    const drawingHeight = heightFeet / feetPerInch;
    const usableW = sheetWidthInches - 4;
    const usableH = sheetHeightInches - 4;

    if (drawingWidth > usableW || drawingHeight > usableH) {
      setScaleWarning(`Site area may not fit entirely on this sheet at ${getScaleLabel(autoScale)}. Consider a larger sheet or smaller area.`);
    } else {
      setScaleWarning(null);
    }
  }, [widthFeet, heightFeet, sheetWidthInches, sheetHeightInches, isAutoScale, setScale, setScaleWarning]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-1">Sheet Size & Scale</h2>
          <p className="text-sm text-geo-text-muted">
            Configure your print sheet dimensions and drawing scale.
          </p>
        </div>

        {/* Drawing Summary — at top for quick reference */}
        {widthFeet > 0 && (
          <Card>
            <h3 className="text-sm font-medium mb-3">Drawing Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-geo-text-muted text-xs">Sheet</div>
                <div className="font-mono">{sheetWidthInches}&quot; × {sheetHeightInches}&quot;</div>
              </div>
              <div>
                <div className="text-geo-text-muted text-xs">Scale</div>
                <div className="font-mono">{scaleLabel}</div>
              </div>
              <div>
                <div className="text-geo-text-muted text-xs">Drawing Size</div>
                <div className="font-mono">
                  {(widthFeet / (scale / 12)).toFixed(1)}&quot; × {(heightFeet / (scale / 12)).toFixed(1)}&quot;
                </div>
              </div>
              <div>
                <div className="text-geo-text-muted text-xs">Site Coverage</div>
                <div className="font-mono">
                  {Math.round((widthFeet / (scale / 12)) / sheetWidthInches * 100)}% of sheet
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Sheet Size */}
        <Card>
          <h3 className="text-sm font-medium mb-4">Print Sheet Size</h3>
          <div className="grid grid-cols-2 gap-3">
            {SHEET_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSheetPreset(preset.id as any)}
                className={`
                  p-3 rounded-lg border text-left transition-colors text-sm
                  ${sheetPreset === preset.id
                    ? 'border-geo-accent bg-geo-accent/5 text-geo-text'
                    : 'border-geo-border hover:border-geo-border-hover text-geo-text-muted'
                  }
                `}
              >
                <div className="font-medium">{preset.label}</div>
                <div className="text-xs text-geo-text-muted mt-0.5">
                  {preset.widthInches}" × {preset.heightInches}"
                </div>
              </button>
            ))}
            <button
              onClick={() => setSheetPreset('custom')}
              className={`
                p-3 rounded-lg border text-left transition-colors text-sm
                ${sheetPreset === 'custom'
                  ? 'border-geo-accent bg-geo-accent/5 text-geo-text'
                  : 'border-geo-border hover:border-geo-border-hover text-geo-text-muted'
                }
              `}
            >
              <div className="font-medium">Custom</div>
              <div className="text-xs text-geo-text-muted mt-0.5">Enter dimensions</div>
            </button>
          </div>

          {sheetPreset === 'custom' && (
            <div className="flex gap-4 mt-4">
              <div className="flex-1">
                <label className="text-xs text-geo-text-muted block mb-1">Width (inches)</label>
                <input
                  type="number"
                  value={sheetWidthInches}
                  onChange={(e) => setCustomSheetSize(Number(e.target.value), sheetHeightInches)}
                  className="w-full bg-geo-bg border border-geo-border rounded-lg px-3 py-2 text-sm"
                  min={8}
                  max={120}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-geo-text-muted block mb-1">Height (inches)</label>
                <input
                  type="number"
                  value={sheetHeightInches}
                  onChange={(e) => setCustomSheetSize(sheetWidthInches, Number(e.target.value))}
                  className="w-full bg-geo-bg border border-geo-border rounded-lg px-3 py-2 text-sm"
                  min={8}
                  max={120}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Drawing Scale */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Drawing Scale</h3>
            <button
              onClick={() => {
                setAutoScale(true);
                // Immediately recalculate if we have dimensions
                if (widthFeet && heightFeet) {
                  const autoScale = autoCalculateScale(widthFeet, heightFeet, sheetWidthInches, sheetHeightInches);
                  setScale(autoScale);
                }
              }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                isAutoScale
                  ? 'bg-geo-accent/10 text-geo-accent border border-geo-accent/30'
                  : 'bg-geo-border text-geo-text-muted hover:text-geo-text'
              }`}
            >
              Auto-fit
            </button>
          </div>
          <div className="space-y-4">
            {/* Scale buttons */}
            <div className="flex flex-wrap gap-2">
              {SCALE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setScaleManual(preset.value);
                  }}
                  className={`
                    px-3 py-2 rounded-lg border text-xs font-mono transition-colors
                    ${scale === preset.value
                      ? 'border-geo-accent bg-geo-accent/10 text-geo-accent'
                      : 'border-geo-border hover:border-geo-border-hover text-geo-text-muted'
                    }
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom scale input — use local string state so the user can freely edit */}
            <CustomScaleInput scale={scale} setScaleManual={setScaleManual} />

            {/* Current scale display */}
            <div className="bg-geo-bg rounded-lg p-3 text-sm">
              <div className="text-geo-text-muted text-xs mb-1">Current Scale</div>
              <div className="font-mono text-lg font-semibold text-geo-text">{scaleLabel}</div>
              <div className="text-xs text-geo-text-muted mt-1">
                1 inch on paper = {Math.round(scale / 12).toLocaleString()} feet in real world
              </div>
            </div>

            {scaleWarning && (
              <div className="flex items-start gap-2 bg-geo-warning/5 border border-geo-warning/20 rounded-lg p-3">
                <Badge variant="warning">Warning</Badge>
                <p className="text-xs text-geo-warning">{scaleWarning}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Summary moved to top */}
      </div>
    </div>
  );
}
