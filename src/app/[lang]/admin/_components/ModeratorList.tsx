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
import { Cancel } from "@/app/[lang]/admin/_components/Cancel";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SoftTag } from "@/components/ui/Tag";
import { inputClass } from "@/components/ui/input-class";
import { useSwapFocus } from "@/components/ui/use-swap-focus";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { adminMessages } from "@/i18n/messages/admin";

type Words = Messages<typeof adminMessages.zh>["moderators"];
type Staff = { me: string; admin: boolean; admins: string[]; moderators: Moderator[] };

/**
 * Who added a moderator: an admin (before ADR 0043, any moderator), the command line (null), or an account deleted
 * since (#54).
 */
function grantedByText(grantedBy: string | null, t: Words): string {
  if (!grantedBy) return t.addedOnServer;
  return grantedBy === DELETED_ACCOUNT ? t.addedByDeleted : t.addedBy(grantedBy);
}

/**
 * 审核员 (#50): the admins (from the server's configuration) and the moderators. Only an admin adds or removes a
 * moderator (ADR 0043); the others see the list. 移除 asks first (#249). Sheets: nothing here opens a page.
 */
export function ModeratorList({ onDone }: { onDone: (result: AdminResult) => void }) {
  const t = useMessages(adminMessages).moderators;
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const answer = useAdminLoad<Staff | Refused>(getModerators, version);
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

  return (
    <div className="space-y-section">
      <Section
        look="sheet"
        title={t.heading(answer.admins.length + answer.moderators.length)}
        description={answer.admin ? t.description : t.descriptionViewOnly}
      >
        <ul className="divide-y divide-border">
          {answer.admins.map((admin) => (
            <li key={admin} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">
                  {admin}
                  {admin === answer.me && <span className="ml-1.5 font-normal text-muted">{t.you}</span>}
                </p>
                <p className="text-meta text-muted">{t.adminFromSettings}</p>
              </div>
              <SoftTag tone="brand">{t.adminTag}</SoftTag>
            </li>
          ))}
          {answer.moderators.map((m) => (
            <ModeratorRow
              key={m.email}
              moderator={m}
              mine={m.email === answer.me}
              canRemove={answer.admin}
              busy={pending && pressed === m.email}
              disabled={pending && pressed !== m.email}
              onRemove={() => run("list", () => removeModerator(m.email), undefined, m.email)}
            />
          ))}
        </ul>
        {answer.moderators.length === 0 && <p className="pb-group text-meta text-muted">{t.noModerators}</p>}
        {failed === "list" && (
          <div className="pb-group">
            <TryAgain />
          </div>
        )}
      </Section>
      {answer.admin && (
        <Section look="sheet" title={t.addHeading}>
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
      )}
    </div>
  );
}

/**
 * One moderator; for an admin, with 移除. It asks first (#249), in the row: a removal takes effect at once. The focus
 * moves to the question and back after 取消 (#189).
 */
function ModeratorRow({
  moderator: m,
  mine,
  canRemove,
  busy,
  disabled,
  onRemove,
}: {
  moderator: Moderator;
  mine: boolean;
  canRemove: boolean;
  busy: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const lang = useLang();
  const t = useMessages(adminMessages).moderators;
  const [confirming, setConfirming] = useState(false);
  const { opener, form } = useSwapFocus<HTMLDivElement, HTMLDivElement>(confirming);

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body font-semibold">
            {m.email}
            {mine && <span className="ml-1.5 font-normal text-muted">{t.you}</span>}
          </p>
          <p className="text-meta text-muted">
            {formatDate(m.grantedAt, lang, { dateStyle: "medium" })} {grantedByText(m.grantedBy, t)}
          </p>
        </div>
        {canRemove && !confirming && (
          <div ref={opener} className="shrink-0">
            <Button
              variant="danger-secondary"
              disabled={disabled}
              onClick={() => setConfirming(true)}
              aria-label={t.removeLabel(m.email)}
            >
              {t.remove}
            </Button>
          </div>
        )}
      </div>
      {confirming && (
        <div ref={form} role="group" aria-label={t.confirmLabel(m.email)} className="mt-2 space-y-2">
          <p className="text-body">{t.confirm(m.email)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="danger" disabled={disabled} loading={busy} onClick={onRemove}>
              {t.confirmRemove}
            </Button>
            <Cancel onClick={() => setConfirming(false)} />
          </div>
        </div>
      )}
    </li>
  );
}
