/**
 * From 1024 px, widen a block past the 48rem main column (set in layout.tsx) to the site container,
 * min(72rem, the window − 3rem), centred like the header. Below 1024 px it does nothing.
 */
export const WIDE_ON_DESKTOP = "lg:mr-0 lg:ml-[calc(50%_-_min(36rem,_50vw_-_1.5rem))] lg:w-[min(72rem,_100vw_-_3rem)]";

/**
 * A band whose background runs the whole width of the window from inside the main column. Its centre is the
 * main column's centre, so content inside lines up with the header even with a classic scrollbar
 * (the extra scrollbar width is clipped by body's overflow-x: clip).
 */
export const FULL_BLEED = "ml-[calc(50%_-_50vw)] w-screen";

/**
 * Side padding that keeps clear of a phone's notch in landscape (viewportFit "cover"): 1rem, or the safe area when it
 * is wider (UI audit 2).
 */
export const SAFE_X = "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";

/** The site-wide content container: the main column's 48rem below 1024 px, min(72rem, window − 3rem) from 1024 px, like the header. */
export const SITE_CONTAINER = `mx-auto w-full max-w-3xl ${SAFE_X} lg:max-w-[min(72rem,_100vw_-_3rem)] lg:px-0`;

/** A column that stays in view below the 3.5rem header while the page scrolls, scrolling inside when taller than the window. */
export const STICKY_COLUMN = "lg:sticky lg:top-18 lg:max-h-[calc(100vh_-_5.5rem)] lg:overflow-y-auto";
