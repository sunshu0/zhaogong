"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { inputClass } from "@/components/ui/input-class";
import { TEAM_NAME_MAX } from "@/components/employer/team";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { answerTeamInvite, getMyTeamInvites, type MyTeamInvite } from "@/app/[lang]/employer/team-actions";
import { setIdentity } from "@/components/seeker/session-client";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { busyProps } from "@/components/ui/busy";

// #257: the shared text box, 16px so phones do not zoom in.
const INPUT = inputClass();

/**
 * 团队邀请 on 我的 (#87): businesses that invited this account. Accepting, with the name the team will see, opens the
 * employer identity for that business and goes to its 团队 page. Nothing shows without invitations.
 */
export function TeamInvites({ email }: { email: string }) {
  const t = useMessages(employerTeamMessages).teamInvites;
  const [invites, setInvites] = useState<{ email: string; list: MyTeamInvite[] }>();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // #202: 婉拒 removes its card; this line takes its place and the focus, even when it was the last invitation.
  // Keyed by the invitation, not the business: declining a second invitation from the same business moves it again.
  const [declined, setDeclined] = useState<{ id: string; name: string }>();
  const declinedRef = useFocusOnChange<HTMLParagraphElement>(declined);
  const router = useRouter();

  useEffect(() => {
    let live = true;
    // #246: with no answer the card stays away, as with no invitations; 我的 still works.
    getMyTeamInvites().then(
      (list) => {
        if (live) setInvites({ email, list });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [email, version]);

  const list = invites?.email === email ? invites.list : [];
  if (!list.length && !declined) return null;

  const answer = (invite: MyTeamInvite, accept: boolean, name = "") =>
    startTransition(async () => {
      const result = await answerTeamInvite(invite.id, accept ? { accept, name } : { accept }).catch(() => null);
      if (!result) return setError(t.networkError);
      if (!result.ok) {
        setError(result.error_zh);
        return setVersion((v) => v + 1);
      }
      setError(undefined);
      if (result.employer) {
        setIdentity({ activeRole: "employer", employer: result.employer });
        router.push("/employer/team");
      } else {
        setDeclined({ id: invite.id, name: invite.employerName });
        setVersion((v) => v + 1);
      }
    });

  return (
    <section id="team-invites" aria-labelledby="team-invites-title">
      <Section>
        <div className="space-y-3 py-group">
          <h2 id="team-invites-title" className="font-semibold">
            {t.heading}
          </h2>
          {error && (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          )}
          {declined && (
            <p ref={declinedRef} tabIndex={-1} role="status" className="text-body text-muted outline-none">
              {t.declinedBefore}
              <span lang={contentLang(declined.name)}>{declined.name}</span>
              {t.declinedAfter}
            </p>
          )}
          {list.map((invite) => (
            <InviteCard
              key={invite.id}
              invite={invite}
              disabled={pending}
              onAccept={(name) => answer(invite, true, name)}
              onDecline={() => answer(invite, false)}
            />
          ))}
        </div>
      </Section>
    </section>
  );
}

function InviteCard({
  invite,
  disabled,
  onAccept,
  onDecline,
}: {
  invite: MyTeamInvite;
  disabled: boolean;
  onAccept: (name: string) => void;
  onDecline: () => void;
}) {
  const words = useMessages(employerTeamMessages);
  const t = words.teamInvites;
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAccept(name);
  };
  return (
    <form
      onSubmit={submit}
      aria-label={t.cardLabel(invite.employerName)}
      className="space-y-2 rounded-card bg-surface p-4 ring-1 ring-border"
    >
      {/* One sentence from the dictionary (ADR 0023): the business's name leads it, in its own lang. */}
      <p className="text-body">
        <span lang={contentLang(invite.employerName)}>{invite.employerName}</span>
        {t.invitedBy(words.team.roleLabel[invite.role])}
      </p>
      <label className="block space-y-1 text-body">
        <span>{t.nameLabel(TEAM_NAME_MAX)}</span>
        <input
          className={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TEAM_NAME_MAX}
          required
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!name.trim()} {...busyProps(disabled)}>
          {t.accept}
        </Button>
        <Button variant="link" onClick={onDecline} {...busyProps(disabled)}>
          {t.decline}
        </Button>
      </div>
    </form>
  );
}
