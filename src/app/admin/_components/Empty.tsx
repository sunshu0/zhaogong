import { Section } from "@/components/ui/Section";

/** A quiet one-line message in a Section: an empty list, or why the page shows nothing. */
export function Empty({ children }: { children: string }) {
  return (
    <Section>
      <p className="py-8 text-center text-body text-muted">{children}</p>
    </Section>
  );
}
