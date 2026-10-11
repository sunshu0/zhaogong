"use client";

// The job list remembers its filters for the tab, so "← 职位列表" on a job page goes back to the same list.
import { useEffect } from "react";

const KEY = "zhaogong:last-list-query";

export function lastListHref(): string {
  try {
    const query = sessionStorage.getItem(KEY);
    return query ? `/?${query}` : "/";
  } catch {
    return "/";
  }
}

/** Rendered on the list page; stores the list's query string. */
export function RememberListQuery({ query }: { query: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, query);
    } catch {
      // Storage can be unavailable (private mode); the link then goes to the home page.
    }
  }, [query]);
  return null;
}
