"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { revealContact } from "@/app/[lang]/jobs/[id]/actions";
import type { Job } from "@/lib/types";
import { CopyButton } from "@/components/seeker/CopyButton";
import { buttonClass } from "@/components/ui/Button";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/** A number a phone can call; the demo's masked numbers (021 ••• 0101（演示）) get no tel: link. */
const DIALABLE = /^\+?[\d\s()-]+$/;

type Loaded = { jobId: string; email: string; contact: Job["contact"] | null };

/** Contact details for signed-in users; a sign-in prompt for everyone else. */
export function ContactReveal({ jobId, kinds }: { jobId: string; kinds: string[] }) {
  const t = useMessages(seekerJobsMessages);
  const hydrated = useHydrated();
  const session = useSession();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const email = session.email;
    revealContact(jobId) // the server reads who is asking from the session cookie
      .catch(() => null)
      .then((contact) => {
        if (!cancelled) setLoaded({ jobId, email, contact });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, session]);

  const current = session && loaded?.jobId === jobId && loaded.email === session.email ? loaded : null;

  return (
    <section aria-labelledby="contact-heading" className="rounded-card bg-surface p-4 shadow-card lg:p-5">
      <h2 id="contact-heading" className="font-medium">
        {t.contact.title}
      </h2>

      {!hydrated ? (
        <div className="mt-2 h-16 animate-pulse rounded-lg bg-background" aria-hidden="true" />
      ) : !session ? (
        <>
          <p className="mt-1 text-sm text-muted">
            {kinds.length ? t.contact.signInFor(kinds.join(t.detail.listJoin)) : t.contact.signInForAny}
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`}
            className={`mt-3 ${buttonClass("primary", { block: true })}`}
          >
            {t.contact.signIn}
          </Link>
        </>
      ) : !current ? (
        <p className="mt-1 text-sm text-muted">{t.contact.loading}</p>
      ) : !current.contact ? (
        <p className="mt-1 text-sm text-danger">{t.contact.failed}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border text-sm">
            {current.contact.phone && (
              <ContactRow label={t.contact.rows.phone}>
                {DIALABLE.test(current.contact.phone) ? (
                  <a
                    href={`tel:${current.contact.phone.replace(/\s+/g, "")}`}
                    className="text-brand underline underline-offset-2"
                  >
                    {current.contact.phone}
                  </a>
                ) : (
                  <span>{current.contact.phone}</span>
                )}
              </ContactRow>
            )}
            {current.contact.wechat && (
              <ContactRow label={t.contact.rows.wechat}>
                <span className="font-mono">{current.contact.wechat}</span>
                <CopyButton text={current.contact.wechat} className="ml-auto" />
              </ContactRow>
            )}
            {current.contact.email && (
              <ContactRow label={t.contact.rows.email}>
                <a href={`mailto:${current.contact.email}`} className="text-brand underline underline-offset-2">
                  {current.contact.email}
                </a>
              </ContactRow>
            )}
          </ul>
          <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{t.contact.warning}</p>
          <p className="mt-2 text-xs text-muted">
            {t.contact.signedInAs(session.email)} ·{" "}
            <Link href="/me" className="underline underline-offset-2">
              {t.contact.mine}
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-10 shrink-0 text-muted">{label}</span>
      {children}
    </li>
  );
}
