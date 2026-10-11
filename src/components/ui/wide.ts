/**
 * From 1024 px, widen a block past the 48rem main column (set in layout.tsx) to min(64rem, the window),
 * centred on the page. Below 1024 px it does nothing. Same rule as line B's B11 post form, so wide pages line up.
 */
export const WIDE_ON_DESKTOP = "lg:mr-0 lg:ml-[calc(50%_-_min(32rem,_50vw_-_1.5rem))] lg:w-[min(64rem,_100vw_-_3rem)]";

/** A column that stays in view below the 3.5rem header while the page scrolls, scrolling inside when taller than the window. */
export const STICKY_COLUMN = "lg:sticky lg:top-18 lg:max-h-[calc(100vh_-_5.5rem)] lg:overflow-y-auto";
