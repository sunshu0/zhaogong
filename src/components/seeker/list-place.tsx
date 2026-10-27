"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { fallbackScroll, parsePlace, returnList, type Place } from "@/components/seeker/list-place-core";

// 操作手感第三件 (#409, ADR 0047): a list's own back link lands where the user was. The browser's back already does
// (Next keeps the list's page and the browser puts the scroll back); a link that goes to the list is a new visit,
// which starts at the top. So when a link in the list is pressed, the list remembers for the tab which item it was
// and where that item sat on the screen, and a back link that goes to that same list (returnTo, markReturn) has it
// put the same item at the same place once it has rendered. An item that is gone (the job closed) falls back to the
// old scroll position, kept inside the page.

const KEY = "zhaogong:list-place";
/** A return is honoured this soon after the back link was pressed; later visits start at the top. */
const RETURN_MS = 10_000;
/** How long the list's items are waited for (they may stream in). */
const WAIT_MS = 5_000;

let returning = 0;

function read(): Place | null {
  try {
    return parsePlace(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function write(place: Place) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(place));
  } catch {
    // Storage can be unavailable (private mode); back links then open the list at the top, as before.
  }
}

const here = () => location.pathname + location.search;

/**
 * For a back link on the page the user is on: the list (path and query) they opened this page from, when that list
 * is at `listPath`, or null. Going there, call markReturn() first and push without scrolling.
 */
export function returnTo(listPath: string): string | null {
  return returnList(read(), location.pathname, listPath);
}

/** The list the next navigation lands on is put back where it was (returnTo). */
export function markReturn() {
  returning = Date.now();
}

/** The pressed link's href when it opens a page of this site in this tab. */
function hrefOf(target: EventTarget) {
  const link = (target as Element).closest?.<HTMLAnchorElement>("a[href]");
  const href = link?.getAttribute("href");
  return link && href?.startsWith("/") && !link.target ? href : null;
}

/**
 * The visible item (the card, or the row) holding a link to `href` inside `root`. A link outside the list's items
 * does not count: from 1280 px the job list's preview column links to the selected job too.
 */
function itemOf(root: Element, href: string) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (link.getAttribute("href") !== href) continue;
    const item = link.closest("article, li");
    if (item && item.getClientRects().length > 0) return item;
  }
  return null;
}

/** Wraps a list (see above). Adds no element of its own (display: contents). */
export function ListPlace({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    const place = read();
    const fresh = Date.now() - returning < RETURN_MS;
    if (!element || !place || !fresh || place.list !== here()) return;
    returning = 0;

    let done = false;
    const observer = new MutationObserver(() => put(false));
    const timer = setTimeout(() => put(true), WAIT_MS);
    function put(last: boolean) {
      if (done || !element || !place) return;
      const item = itemOf(element, place.href);
      if (item) window.scrollBy({ top: item.getBoundingClientRect().top - place.top, behavior: "instant" });
      else if (!last) return;
      else {
        const top = fallbackScroll(place.scrollY, document.documentElement.scrollHeight, innerHeight);
        window.scrollTo({ top, behavior: "instant" });
      }
      stop();
    }
    function stop() {
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      removeEventListener("wheel", stop);
      removeEventListener("touchstart", stop);
      removeEventListener("keydown", stop);
    }
    // The user scrolling or typing first wins.
    addEventListener("wheel", stop, { passive: true });
    addEventListener("touchstart", stop, { passive: true });
    addEventListener("keydown", stop);
    observer.observe(element, { childList: true, subtree: true });
    put(false);
    return stop;
  }, []);

  function remember(target: EventTarget) {
    const element = root.current;
    const href = hrefOf(target);
    if (!element || !href) return;
    const top = (itemOf(element, href) ?? element).getBoundingClientRect().top;
    write({ list: here(), href, top: Math.round(top), scrollY: Math.round(scrollY) });
  }

  return (
    // Pressed (before the page moves), or clicked: a keyboard or a screen reader opens links without a pointer.
    <div
      ref={root}
      className="contents"
      onPointerDownCapture={(e) => remember(e.target)}
      onClickCapture={(e) => remember(e.target)}
    >
      {children}
    </div>
  );
}
