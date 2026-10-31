"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useLang, useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/** Each tab names its language in that language, and marks the text it shows with it. */
const TABS = [
  { key: "zh", lang: "zh-CN" },
  { key: "en", lang: "en" },
] as const;

/**
 * The job description in Chinese or English, one at a time: Chinese first, English first on the English page when
 * the employer wrote it (Round 20). Arrow keys move between the tabs.
 */
/** `plain`: a part of the job page's sheet (#376), no card of its own. */
export function DescriptionTabs({ zh, en, plain = false }: { zh: string; en: string; plain?: boolean }) {
  const t = useMessages(seekerJobsMessages).detail;
  const pageLang = useLang();
  const [current, setCurrent] = useState<"zh" | "en">(pageLang === "en" && en.trim() ? "en" : "zh");
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
    <section
      aria-labelledby={`${id}-heading`}
      className={plain ? "p-4 lg:px-7 lg:py-5" : "rounded-card bg-surface p-4 shadow-card lg:p-6"}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-subtitle font-semibold">
          {t.description}
        </h2>
        <div
          role="tablist"
          aria-label={t.descriptionLanguage}
          className="flex rounded-full bg-neutral-soft p-1 text-body"
        >
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
              className="pressable min-h-11 rounded-full px-4 text-muted aria-selected:bg-surface aria-selected:font-medium aria-selected:text-brand aria-selected:shadow-card"
            >
              <span lang={tab.lang}>{tab.key === "zh" ? t.chinese : t.english}</span>
            </button>
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${current}`}
        lang={TABS.find((tab) => tab.key === current)?.lang}
        className="text-body leading-relaxed break-words whitespace-pre-line"
      >
        {text[current]}
      </div>
    </section>
  );
}
