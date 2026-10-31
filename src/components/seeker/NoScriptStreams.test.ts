import { createElement, Suspense, use } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { NoScriptStreams } from "./NoScriptStreams";

/** The order each streamed part gets from the <noscript> rules, by its id as written in the rules. */
function orderRules(): Map<string, number> {
  const css = renderToStaticMarkup(createElement(NoScriptStreams));
  return new Map([...css.matchAll(/body>div\[id="S:([^"]+)"\]\{order:(\d+)\}/g)].map((m) => [m[1], Number(m[2])]));
}

/** What React itself streams for a page with `count` boundaries that are still loading when the shell goes out. */
async function streamedPage(count: number): Promise<string> {
  const later = Array.from(
    { length: count },
    (_, i) => new Promise<string>((done) => setTimeout(done, 20, `part ${i}`)),
  );
  const Part = ({ i }: { i: number }) => createElement("p", null, use(later[i]));
  const page = createElement(
    "html",
    null,
    createElement(
      "body",
      null,
      createElement(
        "main",
        null,
        ...later.map((_, i) => createElement(Suspense, { key: i, fallback: "…" }, createElement(Part, { i }))),
      ),
    ),
  );
  return new Response(await renderToReadableStream(page)).text();
}

it("gives every part React streams an order rule, in the order of the boundaries on the page (#13)", async () => {
  // Twelve parts: React numbers them in hexadecimal (S:0 … S:9, S:a, S:b), so ten or more is where it shows.
  const html = await streamedPage(12);
  const onPage = [...html.matchAll(/<template id="B:([0-9a-z]+)"/g)].map((m) => m[1]);
  const streamed = [...html.matchAll(/<div hidden id="S:([0-9a-z]+)"/g)].map((m) => m[1]);
  expect(onPage).toHaveLength(12);
  expect([...streamed].sort()).toEqual([...onPage].sort());
  expect(onPage).toContain("a");

  const rules = orderRules();
  expect(onPage.map((id) => rules.get(id))).toEqual(onPage.map((_, i) => i + 1));
});

it("orders the footer after every part", () => {
  const rules = orderRules();
  const css = renderToStaticMarkup(createElement(NoScriptStreams));
  const footer = Number(/body>footer\{order:(\d+)\}/.exec(css)?.[1]);
  expect(footer).toBeGreaterThan(Math.max(...rules.values()));
});
