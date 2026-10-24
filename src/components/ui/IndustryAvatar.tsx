import type { ReactNode } from "react";
import type { Industry } from "@/lib/types";
import { INDUSTRY_TONE } from "@/components/ui/industry-avatar";

/*
 * One small drawing per industry (#375, visual A; V3 of the plan), on a 48×48 grid in the visual A sample's style
 * (docs/design/2026-10-v8/): flat shapes in the --ill-* colours. Classes: m = main (teal), a = accent (orange),
 * k = ink, w = white; s / sk / sm / sw are strokes (globals.css, `.industry-ill`). Drawn for 找工, no outside source.
 */
const DRAWINGS: Record<Industry, ReactNode> = {
  // 餐饮: a steaming bowl with chopsticks.
  hospitality: (
    <>
      <path className="s" d="M18 9c-2 2.2 2 4 0 6.5M24 7.5c-2 2.2 2 4 0 6.5M30 9c-2 2.2 2 4 0 6.5" />
      <path className="sk" d="M30.5 19.5 40 11M33.5 20.5 42 13" />
      <rect className="a" x="8" y="21" width="32" height="4.5" rx="2.25" />
      <path className="m" d="M10 25.5h28a14 13 0 0 1-28 0z" />
      <rect className="m" x="18" y="37.5" width="12" height="3" rx="1.5" />
    </>
  ),
  // 零售: a basket of fruit.
  retail: (
    <>
      <circle className="a" cx="19" cy="19.5" r="5" />
      <circle className="m" cx="28.5" cy="19" r="4.5" />
      <path className="sm" d="M14 23a10 10 0 0 1 20 0" />
      <path className="m" d="M8.5 23h31l-3.2 14.6a3 3 0 0 1-2.9 2.4H14.6a3 3 0 0 1-2.9-2.4z" />
      <path className="sw" d="M19 27.5v8M24 27.5v8M29 27.5v8" />
    </>
  ),
  // 美容美发: scissors.
  beauty: (
    <>
      <path className="sk" d="M19.5 29 34 8.5M28.5 29 14 8.5" />
      <circle className="sm" cx="16" cy="33.5" r="5" />
      <circle className="sm" cx="32" cy="33.5" r="5" />
      <circle className="a" cx="24" cy="21.5" r="2.2" />
    </>
  ),
  // 装修建筑: a house.
  construction: (
    <>
      <path className="m" d="M6.5 24.5 24 10l17.5 14.5H36V40H12V24.5z" />
      <rect className="a" x="20" y="29" width="8" height="11" rx="1" />
      <rect className="w" x="14.5" y="26" width="4.5" height="4" rx=".8" />
      <rect className="w" x="29" y="26" width="4.5" height="4" rx=".8" />
    </>
  ),
  // 清洁: a spray bottle and sparkles.
  cleaning: (
    <>
      <path className="m" d="M17 9.5h10l3 5.5H17z" />
      <path className="s" d="M30 12.2h5.5" />
      <path className="a" d="M16 15h14v4l3 5v14.5a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V24l3-5z" />
      <rect className="w" x="16.5" y="27" width="13" height="8.5" rx="1.5" />
      <path
        className="m"
        d="m39 18 1.1 2.6 2.6 1.1-2.6 1.1L39 25.4l-1.1-2.6-2.6-1.1 2.6-1.1zM40.5 6.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"
      />
    </>
  ),
  // 物流仓储: a parcel.
  logistics: (
    <>
      <path className="a" d="m24 8 15 7.5L24 23 9 15.5z" />
      <path className="m" d="m9 15.5 15 7.5v17L9 32.5z" />
      <path className="k" d="M39 15.5 24 23v17l15-7.5z" />
      <path className="sw" d="m16.5 11.75 15 7.5" />
    </>
  ),
  // 司机: a delivery van.
  driver: (
    <>
      <path className="m" d="M5.5 31V17a3 3 0 0 1 3-3h19v17z" />
      <path className="a" d="M27.5 18.5h7.2l6.8 7.3V31h-14z" />
      <path className="w" d="M29.5 20.5h4.3l4.2 4.5h-8.5z" />
      <rect className="k" x="5.5" y="30" width="36" height="3.5" rx="1.75" />
      <circle className="k" cx="14" cy="34.5" r="4.5" />
      <circle className="k" cx="33" cy="34.5" r="4.5" />
      <circle className="w" cx="14" cy="34.5" r="1.7" />
      <circle className="w" cx="33" cy="34.5" r="1.7" />
    </>
  ),
  // 文员行政: a clipboard with a tick.
  office: (
    <>
      <rect className="m" x="12" y="9" width="23" height="31" rx="3" />
      <rect className="k" x="18.5" y="6" width="10" height="6.5" rx="2" />
      <rect className="w" x="16" y="17" width="15" height="2.6" rx="1.3" />
      <rect className="w" x="16" y="23" width="15" height="2.6" rx="1.3" />
      <rect className="w" x="16" y="29" width="9" height="2.6" rx="1.3" />
      <circle className="a" cx="34" cy="36" r="6.5" />
      <path className="sw" d="m31 36 2.2 2.2 4-4.4" />
    </>
  ),
  // 其他: a shopfront with an awning.
  other: (
    <>
      <rect className="m" x="10" y="20" width="28" height="20" rx="1.5" />
      <path className="a" d="M8 20 11.5 9h25L40 20z" />
      <path className="sw" d="M17.5 9.5 16 20M24 9.5V20M30.5 9.5 32 20" />
      <rect className="w" x="13.5" y="24" width="7" height="6" rx="1" />
      <rect className="w" x="25" y="26" width="8" height="14" rx="1" />
    </>
  ),
};

const TONES = { 1: "bg-(--ill-1)", 2: "bg-(--ill-2)", 3: "bg-(--ill-3)" } as const;

/**
 * An employer's avatar when it has no photo (#375, ADR 0036): a drawing for the industry, on a soft square, instead of
 * the first character in a circle. Decoration only (aria-hidden): the employer's name is always beside it.
 * Sizes like AvatarImage's: 40px, `large` 64px; a row can shrink it from outside (`*:size-6`).
 */
export function IndustryAvatar({ industry, large = false }: { industry: Industry; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-industry={industry}
      className={`flex shrink-0 overflow-hidden rounded-[28%] ${TONES[INDUSTRY_TONE[industry]]} ${large ? "size-16" : "size-10"}`}
    >
      <svg viewBox="0 0 48 48" className="industry-ill size-full">
        {DRAWINGS[industry]}
      </svg>
    </span>
  );
}
