"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { revealContact } from "@/app/jobs/[id]/actions";
import type { Job } from "@/lib/types";
import { CopyButton } from "@/components/seeker/CopyButton";
import { useHydrated, useSession } from "@/components/seeker/session-client";

type Loaded = { jobId: string; email: string; contact: Job["contact"] | null };

/** Contact details for signed-in users; a sign-in prompt for everyone else. */
export function ContactReveal({ jobId, kinds }: { jobId: string; kinds: string[] }) {
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
    <section aria-labelledby="contact-heading" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="contact-heading" className="font-medium">
        联系方式
      </h2>

      {!hydrated ? (
        <div className="mt-2 h-16 animate-pulse rounded-lg bg-background" aria-hidden="true" />
      ) : !session ? (
        <>
          <p className="mt-1 text-sm text-muted">
            {kinds.length ? `登录后可以查看雇主的${kinds.join("、")}。` : "登录后可以查看雇主的联系方式。"}
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`}
            className="mt-3 block rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            登录查看联系方式
          </Link>
        </>
      ) : !current ? (
        <p className="mt-1 text-sm text-muted">正在获取联系方式…</p>
      ) : !current.contact ? (
        <p className="mt-1 text-sm text-danger">暂时无法获取联系方式，请稍后再试。</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border text-sm">
            {current.contact.phone && (
              <ContactRow label="电话">
                <a
                  href={`tel:${current.contact.phone.replace(/\s+/g, "")}`}
                  className="text-brand underline underline-offset-2"
                >
                  {current.contact.phone}
                </a>
              </ContactRow>
            )}
            {current.contact.wechat && (
              <ContactRow label="微信">
                <span className="font-mono">{current.contact.wechat}</span>
                <CopyButton text={current.contact.wechat} className="ml-auto" />
              </ContactRow>
            )}
            {current.contact.email && (
              <ContactRow label="邮箱">
                <a href={`mailto:${current.contact.email}`} className="text-brand underline underline-offset-2">
                  {current.contact.email}
                </a>
              </ContactRow>
            )}
          </ul>
          <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
            联系雇主时，不要预先支付押金、介绍费或任何费用，也不要交出护照原件。遇到这种情况请举报这个职位。
          </p>
          <p className="mt-2 text-xs text-muted">
            已登录：{session.email} ·{" "}
            <Link href="/me" className="underline underline-offset-2">
              我的
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
