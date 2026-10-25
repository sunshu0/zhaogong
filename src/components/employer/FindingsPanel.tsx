"use client";
import type { ReactNode } from "react";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang, DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { complianceMessages } from "@/i18n/messages/compliance";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import type { RequiredField } from "@/lib/ai-post";
import type { Finding, FindingLevel, JobDraft } from "@/lib/compliance";

/** The fields a finding can point at, in Chinese (the moderation queue's language). */
export const FIELD_LABELS: Partial<Record<keyof JobDraft, string>> = employerPostMessages.zh.findings.fields;

export const LEVEL_STYLES: Record<FindingLevel, { className: string }> = {
  block: { className: "bg-danger-soft text-danger" },
  rewrite: { className: "bg-warn-soft text-warn" },
  review: { className: "bg-brand-soft text-brand" },
};

const levelLabel = (level: FindingLevel, lang: Lang): string => {
  const t = pick(employerPostMessages, lang).findings;
  return level === "block" ? t.levelBlock : level === "rewrite" ? t.levelRewrite : t.levelReview;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The message with the words it quotes in their own elements: those are the employer's own words (Finding.matches),
 * and the quoting is the dictionary's (compliance.words.quote), so a quoted word is split off and marked as theirs.
 * A message built in another language than the one shown, as the moderation queue does, simply finds nothing.
 */
function messageParts(finding: Finding, lang: Lang): ReactNode {
  const matches = finding.matches ?? [];
  if (!matches.length) return finding.message_zh;
  const quote = pick(complianceMessages, lang).words.quote;
  const quoted = matches.map(quote);
  const parts = finding.message_zh.split(new RegExp(`(${quoted.map(escapeRegExp).join("|")})`, "g"));
  return parts.map((part, i) => {
    const word = matches[quoted.indexOf(part)];
    return word == null ? (
      part
    ) : (
      <span key={i} lang={contentLang(word)}>
        {part}
      </span>
    );
  });
}

/**
 * One finding: how serious it is, then what the checks said. The message itself comes from the rules
 * (lib/compliance); the moderation queue renders this without a language and keeps Chinese.
 */
export function FindingItem({ finding, lang = DEFAULT_LANG }: { finding: Finding; lang?: Lang }) {
  const style = LEVEL_STYLES[finding.level];
  const suffix = pick(employerPostMessages, lang).findings.levelSuffix;
  return (
    <p className={`rounded-control px-3 py-2 text-body leading-relaxed ${style.className}`}>
      <span className="font-medium">
        {levelLabel(finding.level, lang)}
        {suffix}
      </span>
      {messageParts(finding, lang)}
    </p>
  );
}

/** Everything that holds the draft, with links to the fields. */
export function FindingsPanel({ findings, missing }: { findings: Finding[]; missing: RequiredField[] }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).findings;
  const labels = t.fields as Partial<Record<keyof JobDraft, string>>;
  const clean = findings.length === 0 && missing.length === 0;
  return (
    <section className="rounded-card bg-surface p-4 ring-1 ring-border">
      <h2 className="font-medium">{t.title}</h2>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {clean
          ? t.clean
          : t.summary(
              [findings.length && t.problemCount(findings.length), missing.length && t.missingCount(missing.length)]
                .filter(Boolean)
                .join(t.summaryJoin),
            )}
      </p>
      {clean ? (
        <p className="mt-2 rounded-control bg-ok-soft px-3 py-2 text-body text-ok">{t.cleanNote}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {findings.map((f, i) => (
            <li key={`${f.rule}-${f.field}-${i}`}>
              <a href={`#field-${f.field}`} className="pressable block">
                <span className="mb-1 block text-meta text-muted">{labels[f.field] ?? f.field}</span>
                <FindingItem finding={f} lang={lang} />
              </a>
            </li>
          ))}
          {missing.length > 0 && (
            <li className="rounded-control bg-warn-soft/60 px-3 py-2 text-body">
              <span className="font-medium text-warn">{t.missingLead}</span>
              {missing.map((field, i) => (
                <span key={field}>
                  {i > 0 && t.missingJoin}
                  <a href={`#field-${field}`} className="underline">
                    {labels[field]}
                  </a>
                </span>
              ))}
            </li>
          )}
        </ul>
      )}
      <p className="mt-3 text-meta text-muted">{t.footer}</p>
    </section>
  );
}
