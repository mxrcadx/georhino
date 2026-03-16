import { StepWizard } from '@/components/layout/StepWizard';
import { Header } from '@/components/layout/Header';

export default function Home() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden">
        <StepWizard />
      </main>
    </div>
  );
}
