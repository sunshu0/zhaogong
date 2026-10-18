import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

/** An action whose answer never came (#183), said in the card it was pressed in; what was typed there stays. */
export function TryAgain() {
  return (
    <p role="alert" className="animate-fade-in text-body text-danger">
      没成功，请重试。
    </p>
  );
}

/** A load that got no answer (#183), in the place of the list it was for, with a button to ask again. */
export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Section look="app">
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-body text-muted">{what}没取到，可能是网络断了。</p>
        <Button variant="secondary" onClick={onRetry}>
          重试
        </Button>
      </div>
    </Section>
  );
}
