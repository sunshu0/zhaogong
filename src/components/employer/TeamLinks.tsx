"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/seeker/CopyButton";
import { inputClass } from "@/components/ui/input-class";
import { busyFor } from "@/components/employer/busy-for";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { LINK_DAYS } from "@/components/employer/team";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { createTeamInviteLink, type MyTeam } from "@/app/[lang]/employer/team-actions";

const INPUT = inputClass();

/**
 * 邀请链接 on 团队, for admins (#349, ADR 0028): make a link to send on WeChat and the like; whoever opens it signs in
 * and joins as a member. The link is shown once, right after it is made (only its hash is stored); the links not used
 * yet are listed by who made them and when, with 撤销.
 */
export function TeamLinks({
  team,
  full,
  working,
  onMade,
  onRevoke,
}: {
  team: MyTeam;
  /** The team has no place left (members, invitations and links): 生成 waits, and the invite form says why. */
  full: boolean;
  /** The team change on its way, if any (TeamPage): its button is busy, the others here wait. */
  working: string | undefined;
  /** Reloads the team once a link was made. */
  onMade: () => void;
  onRevoke: (id: string) => void;
}) {
  const words = useMessages(employerTeamMessages).teamPage;
  const t = words.link;
  const lang = useLang();
  const [made, setMade] = useState<{ url: string }>();
  const [error, setError] = useState<string>();
  const madeRef = useFocusOnChange<HTMLHeadingElement>(made);
  const [pending, startTransition] = useTransition();

  const make = () =>
    startTransition(async () => {
      const result = await createTeamInviteLink().catch(() => null);
      if (!result) return setError(words.networkError);
      if (!result.ok) return setError(result.error_zh);
      setError(undefined);
      setMade({ url: new URL(result.path, window.location.origin).toString() });
      onMade();
    });

  return (
    <section aria-labelledby="team-links" className="space-y-3">
      <h2 id="team-links" className="text-subtitle font-semibold">
        {t.heading}
      </h2>
      <div className="space-y-2 rounded-card bg-surface p-4 ring-1 ring-border">
        <p className="text-meta text-muted">{t.hint(LINK_DAYS)}</p>
        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}
        {made && (
          <div className="space-y-2 rounded-control bg-ok-soft p-3">
            <h3 ref={madeRef} tabIndex={-1} className="text-subtitle font-medium outline-none">
              {t.createdHeading}
            </h3>
            <p className="text-meta">{t.createdNote}</p>
            <label className="block space-y-1 text-body">
              <span>{t.linkLabel}</span>
              <input
                className={INPUT}
                readOnly
                value={made.url}
                onFocus={(e) => e.currentTarget.select()}
                spellCheck={false}
              />
            </label>
            <CopyButton text={made.url} label={t.copy} />
          </div>
        )}
        <Button
          variant="secondary"
          onClick={make}
          loading={pending}
          disabled={full || working !== undefined}
          aria-describedby={full ? "team-full" : undefined}
        >
          {t.create}
        </Button>
      </div>
      {team.links.length > 0 && (
        <section aria-labelledby="team-open-links" className="space-y-2">
          <h3 id="team-open-links" className="text-subtitle font-medium">
            {t.openHeading}
          </h3>
          <ul className="divide-y divide-border rounded-card bg-surface ring-1 ring-border">
            {team.links.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="text-body break-all">
                  {t.openRow(link.createdBy, formatDate(link.createdAt, lang), formatDate(link.expiresAt, lang))}
                  {link.expired && <span className="ml-2 text-meta text-muted">{t.expired}</span>}
                </span>
                <Button
                  variant="link"
                  onClick={() => onRevoke(link.id)}
                  {...busyFor(working, `revoke:${link.id}`)}
                  disabled={pending || busyFor(working, `revoke:${link.id}`).disabled}
                >
                  {t.revoke}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
