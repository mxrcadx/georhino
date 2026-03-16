'use client';

import { useAppStore } from '@/store';
import { StepIndicator } from './StepIndicator';
import { Step1SelectArea } from '@/components/steps/Step1_SelectArea';
import { Step2SheetScale } from '@/components/steps/Step2_SheetScale';
import { Step3DataLayers } from '@/components/steps/Step3_DataLayers';
import { Step4ContourSettings } from '@/components/steps/Step4_ContourSettings';
import { Step5PreviewSmoothing } from '@/components/steps/Step5_PreviewSmoothing';
import { Step7Export } from '@/components/steps/Step7_Export';
import { Button } from '@/components/ui/Button';

const STEP_COMPONENTS: Record<number, React.FC> = {
  1: Step1SelectArea,
  2: Step2SheetScale,
  3: Step3DataLayers,
  4: Step4ContourSettings,
  5: Step5PreviewSmoothing,
  6: Step7Export,
};

export function StepWizard() {
  const currentStep = useAppStore((s) => s.currentStep);
  const setCurrentStep = useAppStore((s) => s.setCurrentStep);
  const bbox = useAppStore((s) => s.bbox);

  const StepComponent = STEP_COMPONENTS[currentStep];

  const canGoNext = (): boolean => {
    if (currentStep === 1 && !bbox) return false;
    if (currentStep >= 6) return false;
    return true;
  };

  return (
    <div className="h-full flex flex-col">
      <StepIndicator />
      <div className="flex-1 overflow-hidden">
        <StepComponent />
      </div>
      <div className="px-6 py-3 bg-geo-surface border-t border-geo-border flex justify-between items-center shrink-0">
        <Button
          variant="secondary"
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={currentStep <= 1}
        >
          Back
        </Button>
        <span className="text-xs text-geo-text-muted">
          Step {currentStep} of 6
        </span>
        {currentStep < 6 ? (
          <Button
            variant="primary"
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canGoNext()}
          >
            {currentStep === 5 ? 'Export' : 'Next'}
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
