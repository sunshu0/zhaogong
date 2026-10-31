"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { revealContact } from "@/app/[lang]/jobs/[id]/actions";
import type { Job } from "@/lib/types";
import { CopyButton } from "@/components/seeker/CopyButton";
import { RetryLine } from "@/components/seeker/RetryLine";
import { buttonClass } from "@/components/ui/Button";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/** A number a phone can call; the demo's masked numbers (021 ••• 0101（演示）) get no tel: link. */
const DIALABLE = /^\+?[\d\s()-]+$/;

/** `contact` null: the server would not show them; `failed`: no answer came (#254), which 重试 asks again. */
type Loaded = { jobId: string; email: string; contact: Job["contact"] | null; failed?: boolean };

/** Contact details for signed-in users; a sign-in prompt for everyone else. */
export function ContactReveal({ jobId, kinds }: { jobId: string; kinds: string[] }) {
  const t = useMessages(seekerJobsMessages);
  const hydrated = useHydrated();
  const session = useSession();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const email = session.email;
    // The server reads who is asking from the session cookie.
    revealContact(jobId).then(
      (contact) => !cancelled && setLoaded({ jobId, email, contact }),
      () => !cancelled && setLoaded({ jobId, email, contact: null, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [jobId, session, asked]);

  const current = session && loaded?.jobId === jobId && loaded.email === session.email ? loaded : null;

  return (
    // data-clarity-mask: contact details are never recorded, even masked (#313, ADR 0025 §6).
    <section
      aria-labelledby="contact-heading"
      data-clarity-mask="true"
      className="rounded-card bg-surface p-4 shadow-card lg:p-5"
    >
      <h2 id="contact-heading" className="font-medium">
        {t.contact.title}
      </h2>

      {/* Loading → the contact details or the failure, announced (UI audit 1). */}
      <div aria-live="polite">
        {!hydrated ? (
          <div className="mt-2 h-16 animate-pulse rounded-lg bg-background" aria-hidden="true" />
        ) : !session ? (
          <>
            <p className="mt-1 text-body text-muted">
              {kinds.length ? t.contact.signInFor(kinds.join(t.detail.listJoin)) : t.contact.signInForAny}
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`}
              className={`mt-3 ${buttonClass("secondary", { block: true })}`}
            >
              {t.contact.signIn}
            </Link>
          </>
        ) : !current ? (
          <p className="mt-1 text-body text-muted">{t.contact.loading}</p>
        ) : current.failed ? (
          <RetryLine
            className="mt-1"
            text={t.contact.noAnswer}
            onRetry={() => {
              setLoaded(null);
              setAsked((n) => n + 1);
            }}
          />
        ) : !current.contact ? (
          <p className="mt-1 text-body text-danger">{t.contact.failed}</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-border text-body">
              {current.contact.phone && (
                <ContactRow label={t.contact.rows.phone}>
                  {DIALABLE.test(current.contact.phone) ? (
                    <a
                      href={`tel:${current.contact.phone.replace(/\s+/g, "")}`}
                      translate="no"
                      className="pressable inline-flex min-h-11 min-w-0 items-center break-all text-brand underline underline-offset-2"
                    >
                      {current.contact.phone}
                    </a>
                  ) : (
                    <span lang={contentLang(current.contact.phone)} translate="no" className="min-w-0 break-all">
                      {current.contact.phone}
                    </span>
                  )}
                </ContactRow>
              )}
              {current.contact.wechat && (
                <ContactRow label={t.contact.rows.wechat}>
                  <span translate="no" className="min-w-0 font-mono break-all">
                    {current.contact.wechat}
                  </span>
                  <CopyButton text={current.contact.wechat} className="ml-auto" />
                </ContactRow>
              )}
              {current.contact.email && (
                <ContactRow label={t.contact.rows.email}>
                  <a
                    href={`mailto:${current.contact.email}`}
                    translate="no"
                    className="pressable inline-flex min-h-11 min-w-0 items-center break-all text-brand underline underline-offset-2"
                  >
                    {current.contact.email}
                  </a>
                </ContactRow>
              )}
            </ul>
            <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-meta text-warn">{t.contact.warning}</p>
            <p className="mt-2 text-meta text-muted">
              {t.contact.signedInAs(session.email)} ·{" "}
              <Link href="/me" className="underline underline-offset-2">
                {t.contact.mine}
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-14 shrink-0 text-muted">{label}</span>
      {children}
    </li>
  );
}
