"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

const TABS = [
  { key: "zh", label: "中文", lang: undefined },
  { key: "en", label: "English", lang: "en" },
] as const;

/** The job description in Chinese or English, one at a time (Chinese first). Arrow keys move between the tabs. */
export function DescriptionTabs({ zh, en }: { zh: string; en: string }) {
  const [current, setCurrent] = useState<"zh" | "en">("zh");
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const text = { zh, en };

  function onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setCurrent(TABS[next].key);
    refs.current[next]?.focus();
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-card bg-surface p-4 shadow-card lg:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-subtitle font-semibold">
          职位描述
        </h2>
        <div role="tablist" aria-label="描述语言" className="flex rounded-full bg-neutral-soft p-1 text-body">
          {TABS.map((tab, index) => (
            <button
              key={tab.key}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-${tab.key}`}
              aria-selected={current === tab.key}
              aria-controls={`${id}-panel`}
              tabIndex={current === tab.key ? 0 : -1}
              onClick={() => setCurrent(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="pressable relative min-h-9 rounded-full px-4 text-muted after:absolute after:inset-x-0 after:-inset-y-1 aria-selected:bg-surface aria-selected:font-medium aria-selected:text-brand aria-selected:shadow-card"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${current}`}
        lang={TABS.find((tab) => tab.key === current)?.lang}
        className="text-body leading-relaxed whitespace-pre-line"
      >
        {text[current]}
      </div>
    </section>
  );
}
