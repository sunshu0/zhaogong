"use client";
import { useCallback, useState, useTransition, type FormEvent } from "react";
import {
  addModerator,
  getModerators,
  removeModerator,
  type AdminResult,
  type Refused,
} from "@/app/[lang]/admin/actions";
import type { Moderator } from "@/db/moderators";
import { isFailed, settle } from "@/app/[lang]/admin/load-state";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { inputClass } from "@/components/ui/input-class";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { adminMessages } from "@/i18n/messages/admin";

/** Who added a moderator: another moderator, the command line (null), or an account deleted since (#54). */
function grantedByText(grantedBy: string | null, t: Messages<typeof adminMessages.zh>["moderators"]): string {
  if (!grantedBy) return t.addedOnServer;
  return grantedBy === DELETED_ACCOUNT ? t.addedByDeleted : t.addedBy(grantedBy);
}

/** 审核员 (#50): who may moderate, and adding or removing one by email. The last moderator cannot be removed. */
export function ModeratorList({ onDone }: { onDone: (result: AdminResult) => void }) {
  const lang = useLang();
  const t = useMessages(adminMessages).moderators;
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const answer = useAdminLoad<{ me: string; moderators: Moderator[] } | Refused>(getModerators, version);
  // #183: where an action got no answer — the list (a removal) or the form (an addition, the email stays).
  const [failed, setFailed] = useState<"list" | "add">();
  // #202: which button is on its way — "add", or the email of the row being removed. That one shows it is busy and
  // keeps the focus (Button loading); the others are disabled meanwhile.
  const [pressed, setPressed] = useState<string>();

  const run = (where: "list" | "add", action: () => Promise<AdminResult>, after?: () => void, key: string = where) => {
    setPressed(key);
    setFailed(undefined);
    startTransition(async () => {
      const result = await settle(action);
      if (!result) {
        setFailed(where);
        return;
      }
      onDone(result);
      if (result.ok) after?.();
      reload();
    });
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    run(
      "add",
      () => addModerator(email),
      () => setEmail(""),
    );
  };

  if (isFailed(answer)) return <LoadFailed what={t.listName} onRetry={reload} />;
  if (!answer) return <Loading />;
  if ("refused" in answer) return <Empty>{answer.error_zh}</Empty>;
  const only = answer.moderators.length <= 1;

  return (
    <div className="space-y-section">
      <Section look="app" title={t.heading(answer.moderators.length)} description={t.description}>
        <ul className="divide-y divide-border">
          {answer.moderators.map((m) => (
            <li key={m.email} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">
                  {m.email}
                  {m.email === answer.me && <span className="ml-1.5 font-normal text-muted">{t.you}</span>}
                </p>
                <p className="text-meta text-muted">
                  {formatDate(m.grantedAt, lang, { dateStyle: "medium" })} {grantedByText(m.grantedBy, t)}
                </p>
              </div>
              <Button
                variant="danger-secondary"
                disabled={only || (pending && pressed !== m.email)}
                loading={pending && pressed === m.email}
                title={only ? t.keepOne : undefined}
                onClick={() => run("list", () => removeModerator(m.email), undefined, m.email)}
                className="shrink-0"
                aria-label={t.removeLabel(m.email)}
              >
                {t.remove}
              </Button>
            </li>
          ))}
        </ul>
        {failed === "list" && (
          <div className="pb-group">
            <TryAgain />
          </div>
        )}
      </Section>
      <Section look="app" title={t.addHeading}>
        <form onSubmit={add} className="space-y-2 py-group">
          <label htmlFor="moderator-email" className="block text-body font-semibold">
            {t.emailLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="moderator-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className={`${inputClass()} min-w-0 flex-1`}
            />
            <Button
              type="submit"
              disabled={!email.trim() || (pending && pressed !== "add")}
              loading={pending && pressed === "add"}
            >
              {t.add}
            </Button>
          </div>
          <p className="text-meta text-muted">{t.addNote}</p>
          {failed === "add" && <TryAgain />}
        </form>
      </Section>
    </div>
  );
}
