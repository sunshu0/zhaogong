/**
 * Round 19 (操作质感) classes the employer pages share, after the sample (#141) and docs/design-system.md. The
 * shared components (Button, Card, Select, Checkbox) cover most; these are for the pieces they do not.
 */

/** A block of a page: 16px corners and a soft shadow on white, no border. */
export const APP_CARD = "rounded-card bg-surface p-4 shadow-card lg:p-5";

/** A small outlined action in a card (查看, 续期, 保存): 44px high, 12px corners, answers a press. */
export const ACTION_BUTTON =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 text-body hover:border-muted disabled:cursor-not-allowed disabled:opacity-40 aria-busy:cursor-progress";

/**
 * A choice pill holding a radio or checkbox (续期多久, 招到了吗, 岗位类别): filled in the brand's soft colour when
 * chosen. Use ChoicePill, which puts the input inside.
 */
export const CHOICE_PILL =
  "pressable inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-background px-3.5 text-body has-checked:bg-brand-soft has-checked:font-medium has-checked:text-brand has-disabled:cursor-not-allowed has-disabled:opacity-40";

/** The browser's radio in the app's style (as ui Radio draws it): a ring whose middle fills when chosen. */
export const CHOICE_DOT =
  "size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted/60 bg-surface transition-[border-width,border-color] duration-(--duration-press) checked:border-[6px] checked:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed";

/**
 * The sticky bar at the foot of a form (保存, 预览, 发布): see-through white with the page blurred behind it and a
 * hairline above, like the job page's action bar (#141).
 */
export const STICKY_BAR =
  "sticky bottom-0 z-10 -mx-4 bg-surface/90 px-4 py-3 shadow-[0_-1px_0_var(--border)] backdrop-blur-md backdrop-saturate-150";

/** A text action on a bar (取消, 上一步, 返回修改): grey, underlined, 44px high. */
export const BAR_TEXT_ACTION = "pressable inline-flex min-h-11 shrink-0 items-center text-body text-muted underline";

/** The 「← 职位管理」 link above a page's title: brand text, 44px high. */
export const BACK_LINK =
  "pressable -my-2 inline-flex min-h-11 items-center text-body text-brand underline-offset-4 hover:underline";

/** A notice line under a form (saved, failed): 12px corners like the controls. */
export const noticeClass = (ok: boolean) =>
  `rounded-control px-3 py-2 text-body outline-none ${ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`;
