"use client";
import type { KeyboardEvent, ReactNode } from "react";

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
}

/** Ids that tie the tabs to their panel. */
export const tabIds = (base: string, key: string) => ({ tab: `${base}-tab-${key}`, panel: `${base}-panel` });

/**
 * A tab row following the ARIA tabs pattern: only the selected tab is in the Tab order, and the
 * arrow keys, Home and End move between tabs. Pair it with <TabPanel> using the same `idBase`.
 */
export function TabList<K extends string>({
  label,
  idBase,
  tabs,
  value,
  onChange,
  className = "",
  tabClassName,
}: {
  label: string;
  idBase: string;
  tabs: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  tabClassName: (selected: boolean) => string;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = tabs.findIndex((t) => t.key === value);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    const key = tabs[(next + tabs.length) % tabs.length].key;
    onChange(key);
    document.getElementById(tabIds(idBase, key).tab)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={className}>
      {tabs.map((t) => {
        const selected = t.key === value;
        const ids = tabIds(idBase, t.key);
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={onKeyDown}
            className={tabClassName(selected)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idBase,
  value,
  className,
  children,
}: {
  idBase: string;
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const ids = tabIds(idBase, value);
  return (
    <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} className={className}>
      {children}
    </div>
  );
}
