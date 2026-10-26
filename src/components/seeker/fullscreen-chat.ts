"use client";

// T1 (#397, ADR 0042): below 1024 px an open conversation fills the screen, like a chat app. Which one is open lives in
// the address (?conversation=), so the phone's back key closes it and a reload keeps it open.
import { useCallback, useEffect, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";

/** Where the list and the open conversation stop sitting side by side (Tailwind's lg). */
export const FULLSCREEN_CHAT_QUERY = "(width < 64rem)";
const PARAM = "conversation";

/** A history entry: its address and how long the history was once it was there. */
export type HistoryEntry = { href: string; length: number };

/**
 * The entry this page pushed when a conversation was opened from the list. Kept here rather than in history.state,
 * which Next replaces with its own on later updates.
 */
let pushed: HistoryEntry | null = null;

/** The page's address with this conversation open (or none), other parameters kept. */
export function conversationAddress(location: { pathname: string; search: string }, id: string | null): string {
  const params = new URLSearchParams(location.search);
  if (id) params.set(PARAM, id);
  else params.delete(PARAM);
  const search = params.toString();
  return `${location.pathname}${search ? `?${search}` : ""}`;
}

/**
 * Whether ← can go back in the history to reach the list: only from the very entry this page pushed when the
 * conversation was opened from it. Anywhere else (a link straight to a conversation from another page, a reload, the
 * same address reached again later) going back would leave /messages, so the address is replaced instead.
 */
export function backReachesList(pushedEntry: HistoryEntry | null, here: HistoryEntry): boolean {
  return pushedEntry !== null && pushedEntry.href === here.href && pushedEntry.length === here.length;
}

const hereNow = (): HistoryEntry => ({ href: window.location.href, length: window.history.length });

/** The open conversation, from the address; `open` and `close` change the address (Next follows history calls). */
export function useOpenConversation() {
  const selectedId = useSearchParams().get(PARAM);
  const open = useCallback((id: string) => {
    const url = conversationAddress(window.location, id);
    // A phone opens a screen, so it gets a history entry; side by side (desktop) a click only changes the address.
    if (window.matchMedia(FULLSCREEN_CHAT_QUERY).matches) {
      window.history.pushState(null, "", url);
      pushed = hereNow();
    } else {
      window.history.replaceState(null, "", url);
    }
  }, []);
  const close = useCallback(() => {
    if (backReachesList(pushed, hereNow())) window.history.back();
    else window.history.replaceState(null, "", conversationAddress(window.location, null));
  }, []);
  return { selectedId, open, close };
}

/**
 * The visible part of the window while a conversation fills the screen. Where the browser honours
 * `interactive-widget=resizes-content` (the chat page's viewport) the keyboard already shrinks the page; where it does
 * not (Safari), only the visual viewport shrinks and may scroll, so the chat takes its height and top from it, and
 * the box stays on the keyboard.
 */
export function useVisibleViewport(element: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const box = element.current;
    const viewport = window.visualViewport;
    if (!active || !box || !viewport) return;
    const apply = () => {
      box.style.setProperty("--chat-height", `${viewport.height}px`);
      box.style.setProperty("--chat-top", `${viewport.offsetTop}px`);
    };
    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      box.style.removeProperty("--chat-height");
      box.style.removeProperty("--chat-top");
    };
  }, [element, active]);
}

/** How much shorter than the tallest it has been the visible window must get before it counts as a keyboard. */
export const KEYBOARD_MIN_PX = 150;

/**
 * Whether the phone's keyboard is up (#405): a field in the chat has the focus and the visible window is at least
 * KEYBOARD_MIN_PX shorter than the tallest it has been at this width. Without the focus a shorter window is the
 * browser's own bars, not a keyboard.
 */
export function keyboardIsUp(tallest: number, height: number, typing: boolean): boolean {
  return typing && tallest - height >= KEYBOARD_MIN_PX;
}

/**
 * Whether the keyboard is up over the open conversation inside `element` (#405), while `active` (a phone, a
 * conversation open). The chat folds its job bar then, so the messages keep the room.
 */
export function useKeyboardUp(element: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const box = element.current;
    const viewport = window.visualViewport;
    if (!active || !box || !viewport) return;
    let width = viewport.width;
    let tallest = viewport.height;
    const check = () => {
      // Turning the phone starts over.
      if (Math.abs(viewport.width - width) > 1) {
        width = viewport.width;
        tallest = viewport.height;
      }
      tallest = Math.max(tallest, viewport.height);
      const field = document.activeElement;
      const typing = field instanceof HTMLElement && box.contains(field) && field.matches("textarea, input");
      setUp(keyboardIsUp(tallest, viewport.height, typing));
    };
    check();
    viewport.addEventListener("resize", check);
    box.addEventListener("focusin", check);
    box.addEventListener("focusout", check);
    return () => {
      viewport.removeEventListener("resize", check);
      box.removeEventListener("focusin", check);
      box.removeEventListener("focusout", check);
      setUp(false);
    };
  }, [element, active]);
  return active && up;
}
