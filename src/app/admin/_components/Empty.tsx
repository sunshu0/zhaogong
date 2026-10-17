import { Section } from "@/components/ui/Section";

/** A quiet one-line message in a card: an empty list, or why the page shows nothing. */
export function Empty({ children }: { children: string }) {
  return (
    <Section look="app">
      <p className="py-8 text-center text-body text-muted">{children}</p>
    </Section>
  );
}

/** A queue on its way (Round 19): cards that gently pulse where it will be. */
export function Loading({ cards = 2, height = "h-40" }: { cards?: number; height?: string }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">正在加载</span>
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`${height} animate-shimmer rounded-card bg-surface shadow-card`}
        />
      ))}
    </div>
  );
}
