"use client";
import { useCallback, useState } from "react";
import { getModeratorChanges, type Refused } from "@/app/[lang]/admin/actions";
import { isFailed } from "@/app/[lang]/admin/load-state";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import type { ModeratorChange } from "@/db/moderators";
import { Section } from "@/components/ui/Section";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { adminMessages } from "@/i18n/messages/admin";

// When it was done: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/**
 * 审核员变动记录 (ADR 0043): every moderator added or removed, newest first, and by whom — an admin, or the command line.
 * For admins only; the server refuses anyone else.
 */
export function ModeratorChanges() {
  const lang = useLang();
  const t = useMessages(adminMessages).changes;
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const answer = useAdminLoad<{ changes: ModeratorChange[] } | Refused>(getModeratorChanges, version);

  if (isFailed(answer)) return <LoadFailed what={t.listName} onRetry={reload} />;
  if (!answer) return <Loading cards={1} />;
  if ("refused" in answer) return <Empty>{answer.error_zh}</Empty>;
  const who = (email: string | null) => (!email ? t.commandLine : email === DELETED_ACCOUNT ? t.deleted : email);

  return (
    <Section look="sheet" title={t.title} description={t.description}>
      {answer.changes.length === 0 ? (
        <p className="py-group text-body text-muted">{t.empty}</p>
      ) : (
        <ol className="divide-y divide-border">
          {answer.changes.map((c) => (
            <li key={c.id} className="flex gap-3 py-3 text-body">
              <time dateTime={c.at} className="w-24 shrink-0 text-muted">
                {formatDate(c.at, lang, TIME)}
              </time>
              <span className="min-w-0 break-all">
                {c.action === "grant" ? t.grant(who(c.email)) : t.revoke(who(c.email))}
                <span className="block text-meta text-muted">{t.by(who(c.by))}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
