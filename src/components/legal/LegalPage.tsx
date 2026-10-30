// #323: the privacy page and the terms of use, laid out the same way from their dictionaries: the title, when it was
// last updated, a table of contents, then numbered sections of
// paragraphs, lists, tables and links to official pages. Server only: no JavaScript of its own.
import type { LegalBlock } from "@/i18n/messages/legal-privacy";

export interface LegalWords {
  title: string;
  updated: string;
  tocLabel: string;
  sections: readonly { id: string; heading: string; body: readonly LegalBlock[] }[];
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  if ("list" in block)
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  if ("table" in block)
    return (
      <div role="region" aria-label={block.table.head.join(" / ")} tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted">
              {block.table.head.map((cell) => (
                <th key={cell} scope="col" className="py-2 pr-3 font-normal">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {block.table.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="py-2 pr-3 text-left font-mono text-meta font-normal">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className="py-2 pr-3 align-top">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <ul className="space-y-1">
      {block.links.map((link) => (
        <li key={link.href}>
          <a href={link.href} rel="noopener noreferrer" className="text-brand underline underline-offset-2">
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function LegalPage({ words }: { words: LegalWords }) {
  return (
    <article className="mx-auto max-w-3xl space-y-section text-body leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-title font-semibold">{words.title}</h1>
        <p className="text-meta text-muted">{words.updated}</p>
      </header>
      <nav aria-label={words.tocLabel} className="rounded-card bg-surface p-4 shadow-card">
        <h2 className="mb-2 text-meta font-semibold text-muted">{words.tocLabel}</h2>
        <ol className="space-y-1">
          {words.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-brand underline-offset-2 hover:underline">
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {words.sections.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="space-y-3">
          <h2 id={`${section.id}-heading`} className="text-subtitle font-semibold">
            {section.heading}
          </h2>
          {section.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </article>
  );
}
