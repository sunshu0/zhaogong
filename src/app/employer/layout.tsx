import type { ReactNode } from "react";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";

/**
 * Every employer page wears the Round 19 type (`type-app`, as the sample #141 does). NoScriptStreams: the pages now
 * have loading.tsx, so without JavaScript their content streams in after the skeleton; this shows it as before.
 */
export default function EmployerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="type-app">
      {children}
      <NoScriptStreams />
    </div>
  );
}
