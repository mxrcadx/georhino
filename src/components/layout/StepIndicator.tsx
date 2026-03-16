'use client';

import { useAppStore } from '@/store';

const STEPS = [
  { number: 1, label: 'Select Area' },
  { number: 2, label: 'Sheet & Scale' },
  { number: 3, label: 'Data Layers' },
  { number: 4, label: 'Contours' },
  { number: 5, label: 'Preview' },
  { number: 6, label: 'Export' },
];

export function StepIndicator() {
  const currentStep = useAppStore((s) => s.currentStep);
  const setCurrentStep = useAppStore((s) => s.setCurrentStep);
  const bbox = useAppStore((s) => s.bbox);

  const canNavigateTo = (step: number): boolean => {
    if (step === 1) return true;
    if (!bbox) return false;
    return step <= currentStep + 1;
  };

  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-geo-surface border-b border-geo-border overflow-x-auto">
      {STEPS.map((step, i) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const canNav = canNavigateTo(step.number);

        return (
          <div key={step.number} className="flex items-center">
            <button
              onClick={() => canNav && setCurrentStep(step.number)}
              disabled={!canNav}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap
                ${isActive
                  ? 'bg-geo-accent/10 text-geo-accent border border-geo-accent/30'
                  : isCompleted
                    ? 'text-geo-text-muted hover:text-geo-text'
                    : canNav
                      ? 'text-geo-text-muted hover:text-geo-text'
                      : 'text-geo-text-muted/40 cursor-not-allowed'
                }
              `}
            >
              <span
                className={`
                  w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${isActive
                    ? 'bg-geo-accent text-white'
                    : isCompleted
                      ? 'bg-geo-text-muted/20 text-geo-text-muted'
                      : 'bg-geo-border text-geo-text-muted/50'
                  }
                `}
              >
                {isCompleted ? '\u2713' : step.number}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-px mx-1 ${isCompleted ? 'bg-geo-text-muted/30' : 'bg-geo-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
