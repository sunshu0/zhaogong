import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { sheetClass } from "@/components/ui/Card";

/**
 * A page with nothing to show (Round 19): a page or a job that is not there, or an error. One card in the middle
 * with an icon, the heading, one line on why, and the way on (one main button, at most one more).
 */
export function StatusCard({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className={`type-app mx-auto mt-6 max-w-md text-center ${sheetClass({ padded: false })} px-6 py-10`}>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-title font-semibold">{title}</h1>
      <p className="mt-2 text-body text-muted">{children}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  );
}
