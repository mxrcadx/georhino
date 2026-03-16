'use client';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex justify-between text-xs text-geo-text-muted">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="h-1.5 bg-geo-border rounded-full overflow-hidden">
        <div
          className="h-full bg-geo-accent rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
