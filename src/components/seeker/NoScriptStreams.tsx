/** How many streamed parts a page may have; the order rules cover them all. */
const MAX_PARTS = 40;

/**
 * With JavaScript off (#13). Next streams every Suspense boundary's content after the page shell, as
 * `<div hidden id="S:n">`, and a small script moves it into place; without scripts it stays hidden and the loading
 * placeholders stay on screen. These rules (inside <noscript>, so they apply only then) show the streamed parts
 * after the page's own content and before the footer, in the order of their boundaries on the page, and hide the
 * placeholders marked `data-nojs-hide` (loading placeholders that only a script would replace). The parts cannot
 * go back to their exact places without a script, so a page with several parts shows them one after the other
 * below its fixed content.
 */
export function NoScriptStreams() {
  const order = Array.from({ length: MAX_PARTS }, (_, i) => `body>div[id="S:${i}"]{order:${i + 1}}`).join("");
  const css =
    "body{display:flex;flex-direction:column}" +
    // Tailwind's preflight hides [hidden] with !important in @layer base; an !important rule wins only from an
    // earlier layer, and "theme" comes before "base".
    '@layer theme{body>div[hidden][id^="S:"]{display:block!important}}' +
    order +
    // The parts sit outside <main>, so they take its width and padding; <main> no longer fills the screen.
    'body>div[id^="S:"]{box-sizing:border-box;width:100%;max-width:48rem;margin-inline:auto;padding:0 1rem 1rem}' +
    '@media (width>=64rem){body>div[id^="S:"]{max-width:min(64rem,100vw - 3rem);padding-inline:0}}' +
    "body>main{flex:none}" +
    `body>footer{order:${MAX_PARTS + 1}}` +
    "[data-nojs-hide]{display:none!important}";
  return (
    <noscript>
      <style>{css}</style>
    </noscript>
  );
}
