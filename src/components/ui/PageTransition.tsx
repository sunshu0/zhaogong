import { ViewTransition, type ReactNode } from "react";
import "./page-transition.css";

/**
 * Round 19 page transitions (#171): going into a detail page, the content slides a little to the left and fades
 * in; coming back, the other way. Only navigations tagged with a direction animate: links pass
 * `transitionTypes={FORWARD}` / `BACK` (or router.push(href, { transitionTypes })). Filters, paging, other
 * updates and the browser's own back do not. The header and the bottom bar stay put; with "reduce motion" nothing
 * moves (page-transition.css). Wrap a page's outermost element; it adds no element of its own.
 */
export const FORWARD = ["nav-forward"];
export const BACK = ["nav-back"];

const SLIDE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={SLIDE} exit={SLIDE} default="none">
      {children}
    </ViewTransition>
  );
}
