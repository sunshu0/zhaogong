import { contactRows, resumeRows, type ResumeDoc } from "@/components/seeker/resume-doc";

/** The id the print style keeps: everything else on the page is left out of the printout. */
export const RESUME_SHEET_ID = "resume-sheet";

/**
 * 中英文简历 (#86): one A4 page, Chinese first and the person's own English under it. No hooks, so the share page
 * renders it on the server and the resume page in the browser.
 */
export function ResumeSheet({ doc }: { doc: ResumeDoc }) {
  const rows = resumeRows(doc);
  const contact = contactRows(doc.contact);
  return (
    // The sheet is the CV itself, in both languages whatever the page's (Round 20): Chinese, with its English parts
    // marked lang="en".
    <article
      id={RESUME_SHEET_ID}
      lang="zh-CN"
      aria-label="中英文简历 · CV"
      className="mx-auto w-full max-w-[210mm] rounded-card bg-white px-5 py-6 text-[#1f2421] shadow-card sm:px-10 sm:py-9 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
    >
      <header className="border-b-2 border-brand pb-3">
        <h2 className="text-2xl font-semibold leading-tight">{doc.zh.name}</h2>
        {doc.en.name && (
          <p lang="en" className="font-latin text-lg leading-tight">
            {doc.en.name}
          </p>
        )}
        {doc.zh.headline && <p className="mt-2 text-body">{doc.zh.headline}</p>}
        {doc.zh.headline && doc.en.headline && (
          <p lang="en" className="font-latin text-meta text-muted">
            {doc.en.headline}
          </p>
        )}
        {contact.length > 0 && (
          <ul aria-label="联系方式" className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-meta">
            {contact.map((item) => (
              <li key={item.id}>
                <span className="text-muted">
                  {item.zh} <span lang="en">{item.en}</span>
                </span>{" "}
                <span className="font-latin">{item.value}</span>
              </li>
            ))}
          </ul>
        )}
      </header>
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <dt className="text-meta font-medium">
              {row.zhLabel}{" "}
              <span lang="en" className="font-latin font-normal text-muted">
                {row.enLabel}
              </span>
            </dt>
            <dd className="min-w-0 text-body">
              <p className="whitespace-pre-line break-words">{row.zh}</p>
              {row.en && (
                <p lang="en" className="font-latin whitespace-pre-line break-words text-muted">
                  {row.en}
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {doc.workRights && (
        <p className="mt-3 text-meta text-muted">
          签证情况由本人填写。 <span lang="en">Work rights as stated by the job seeker.</span>
        </p>
      )}
    </article>
  );
}

/**
 * Printing (and 存为 PDF) keeps only the sheet: the rest of the page, the header and the bottom bar are left out
 * rather than hidden, so they take no room and the sheet fits one A4 page.
 */
export function ResumePrintStyle() {
  const sheet = `#${RESUME_SHEET_ID}`;
  return (
    <style>{`@media print {
  @page { size: A4; margin: 14mm; }
  body *:not(${sheet}):not(${sheet} *):not(:has(${sheet})) { display: none !important; }
  body *:has(${sheet}) { display: block !important; position: static !important; margin: 0 !important;
    padding: 0 !important; border: 0 !important; width: auto !important; max-width: none !important;
    background: none !important; box-shadow: none !important; }
  ${sheet} { font-size: 10.5pt; }
}`}</style>
  );
}
