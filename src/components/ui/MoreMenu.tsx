"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { nextMenuIndex } from "@/components/ui/menu-keys";
import { sheetFromBottom } from "@/components/ui/use-sheet";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

export type MoreMenuItem = {
  label: string;
  /** Destructive actions (结束招聘, 举报) are shown in red. */
  danger?: boolean;
  disabled?: boolean;
} & ({ onSelect: () => void; href?: never } | { href: string; onSelect?: never });

/**
 * 「更多」: secondary actions behind one button, so a card or page keeps a single primary button.
 * Keyboard: Enter, Space or ↓ opens on the first item, ↑ on the last; arrows, Home and End move; Escape closes
 * and returns to the button; Tab closes and moves on. From 768 px a dropdown; on a phone the same menu in a
 * BottomSheet (#413), which a tap on the dimmed page or a drag down closes, and where Tab stays inside.
 */
export function MoreMenu({
  items,
  label,
  showLabel = false,
  align = "end",
}: {
  items: MoreMenuItem[];
  /** The button's accessible name, e.g. 「更多操作：点心师傅」 when a list has many menus. */
  label?: string;
  /** Show 「更多」 next to the icon instead of the icon alone. */
  showLabel?: boolean;
  align?: "start" | "end";
}) {
  const words = useMessages(uiMessages).nav;
  const name = label ?? words.more;
  const [open, setOpen] = useState(false);
  // Decided when it opens: a sheet on a phone-sized window, else the dropdown.
  const [sheet, setSheet] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const firstFocus = useRef(0);
  // What to do once the sheet has closed: until then the page behind it is inert and takes no focus.
  const afterSheet = useRef<{ focus: boolean; run?: () => void } | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      const after = afterSheet.current;
      afterSheet.current = null;
      if (after?.focus) button.current?.focus();
      after?.run?.();
      return;
    }
    itemRefs.current[firstFocus.current]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openAt(index: number) {
    firstFocus.current = index;
    setSheet(sheetFromBottom());
    setOpen(true);
  }

  /** Closes, gives the focus back to the button if asked, then runs `then` (the chosen item). */
  function close(returnFocus: boolean, then?: () => void) {
    setOpen(false);
    if (sheet) {
      afterSheet.current = { focus: returnFocus, run: then };
      return;
    }
    if (returnFocus) button.current?.focus();
    then?.();
  }

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openAt(e.key === "ArrowDown" ? 0 : items.length - 1);
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      // In the sheet, a modal, Tab moves to 关闭 instead.
      if (!sheet) close(false);
      return;
    }
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const next = nextMenuIndex(e.key, current, items.length);
    if (next === null) return;
    e.preventDefault();
    itemRefs.current[next]?.focus();
  }

  const itemClass = (item: MoreMenuItem) =>
    `pressable-row flex min-h-11 w-full items-center rounded-control px-3 text-left text-body hover:bg-background focus:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset aria-disabled:opacity-50 ${
      item.danger ? "text-danger" : ""
    }`;

  const menuItems = items.map((item, i) => {
    const common = {
      ref: (el: HTMLElement | null) => {
        itemRefs.current[i] = el;
      },
      role: "menuitem",
      tabIndex: -1,
      "aria-disabled": item.disabled || undefined,
      className: itemClass(item),
    } as const;
    if (item.href !== undefined && !item.disabled) {
      return (
        <Link key={item.label} href={item.href} {...common} onClick={() => close(false)}>
          {item.label}
        </Link>
      );
    }
    return (
      <button
        key={item.label}
        type="button"
        {...common}
        onClick={() => {
          if (!item.disabled) close(true, item.onSelect);
        }}
      >
        {item.label}
      </button>
    );
  });

  return (
    <div ref={root} className="relative inline-block">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={showLabel ? undefined : name}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onButtonKeyDown}
        className="pressable inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-body text-muted hover:bg-background hover:text-foreground"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
        {showLabel && name}
      </button>
      {open && !sheet && (
        <div
          id={menuId}
          role="menu"
          aria-label={name}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-30 mt-1 min-w-40 animate-pop-in rounded-control bg-surface p-1 shadow-pop ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {menuItems}
        </div>
      )}
      {open && sheet && (
        <BottomSheet open onClose={() => close(true)} title={name}>
          <div id={menuId} role="menu" aria-label={name} onKeyDown={onMenuKeyDown}>
            {menuItems}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
