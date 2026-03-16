'use client';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  valueLabel?: string;
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, valueLabel }: SliderProps) {
  return (
    <div className="flex flex-col gap-2">
      {(label || valueLabel) && (
        <div className="flex justify-between items-center">
          {label && <label className="text-xs text-geo-text-muted uppercase tracking-wider">{label}</label>}
          {valueLabel && <span className="text-sm text-geo-text font-mono">{valueLabel}</span>}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
