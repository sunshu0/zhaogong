"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { countAt, totalCountUpMs } from "@/components/seeker/count-up";
import { formatCount } from "@/components/seeker/landing";

/** The browser can run the count-up: scripting is on and the user has not asked for less motion. */
const CAN_ANIMATE = "(scripting: enabled) and (prefers-reduced-motion: no-preference)";

/**
 * Until this component takes over, the animated digits are hidden (keeping their size) wherever CAN_ANIMATE
 * holds, so nobody sees the real number flash back to 0. Without JavaScript, with reduced motion, or where
 * the browser does not know the `scripting` media feature, the rule does not apply and the real number shows.
 */
const HIDDEN_UNTIL_READY = "[@media(scripting:enabled)_and_(prefers-reduced-motion:no-preference)]:invisible";

const noop = () => () => {};

export interface CountUpStat {
  key: string;
  label: string;
  value: number;
}

/**
 * The landing page's stats: big numbers that count up from 0 the first time about 30% of the band is in view,
 * once per page load. The server renders the real numbers; screen readers read only those.
 */
export function CountUpStats({ stats }: { stats: CountUpStat[] }) {
  const ref = useRef<HTMLDListElement>(null);
  const canAnimate = useSyncExternalStore(
    noop,
    () => window.matchMedia(CAN_ANIMATE).matches && "IntersectionObserver" in window,
    () => false,
  );
  // null: waiting to come into view; a number: milliseconds since counting started.
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const dl = ref.current;
    if (!canAnimate || !dl) return;
    let frame = 0;
    const total = totalCountUpMs(stats.length);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.intersectionRatio >= 0.3)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(now - start, total);
          setElapsed(t);
          if (t < total) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: [0, 0.3, 1] },
    );
    observer.observe(dl);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [canAnimate, stats.length]);

  return (
    <dl
      ref={ref}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4"
    >
      {stats.map((stat, i) => {
        const shown = !canAnimate ? stat.value : elapsed === null ? 0 : countAt(stat.value, elapsed, i);
        const final = formatCount(stat.value);
        return (
          <div key={stat.key} className="flex flex-col-reverse gap-2 bg-surface px-5 py-6">
            <dt className="text-sm text-muted">{stat.label}</dt>
            <dd className="text-[2.5rem] leading-none font-semibold text-brand tabular-nums">
              <span className="sr-only">{final}</span>
              <span
                aria-hidden="true"
                data-count-up=""
                // Room for the final number from the start, so nothing moves while it counts.
                style={{ minWidth: `${final.length}ch` }}
                className={`inline-block ${canAnimate ? "" : HIDDEN_UNTIL_READY}`}
              >
                {formatCount(shown)}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
