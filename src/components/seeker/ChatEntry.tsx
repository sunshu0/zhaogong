"use client";

export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
