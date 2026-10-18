"use client";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Checkbox";
import { SkeletonList } from "@/components/ui/Skeleton";
import { noticeClass } from "@/components/employer/app-style";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { useMyTeam } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { INVITE_DAYS, TEAM_MAX, TEAM_NAME_MAX, teamSignature, type TeamMember } from "@/components/employer/team";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import {
  cancelTeamInvite,
  changeMyTeam,
  inviteTeammate,
  setMyTeamName,
  type MyTeam,
} from "@/app/[lang]/employer/team-actions";
import { inputClass } from "@/components/ui/input-class";
import { busyProps } from "@/components/ui/busy";

const INPUT = inputClass();

type Done = { ok: true } | { ok: false; error_zh: string };

/**
 * 团队 (#87, PRD R-38): who works for the business. Admins invite by email, change roles and remove people; anyone
 * sets the name the team sees on their replies, or leaves. The server checks every change.
 */
export function TeamPage() {
  return <EmployerGate next="/employer/team">{(me) => <Team me={me} />}</EmployerGate>;
}

function Team({ me }: { me: EmployerIdentity }) {
  const words = useMessages(employerTeamMessages);
  const t = words.teamPage;
  const roles = words.team.roleLabel;
  const { team, reload } = useMyTeam(me.email);
  // What a change did, in a line that may carry a person's own name in its own lang.
  const [message, setMessage] = useState<{ ok: boolean; text: ReactNode }>();
  const messageRef = useFocusOnChange<HTMLParagraphElement>(message);
  const [pending, startTransition] = useTransition();

  /** Runs one change on the server, says how it went, and reloads the team. */
  const run = (action: () => Promise<Done>, okText: ReactNode, after?: () => void) =>
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false as const, error_zh: t.networkError }));
      setMessage(result.ok ? { ok: true, text: okText } : { ok: false, text: result.error_zh });
      if (result.ok) (after ?? reload)();
    });

  if (team === undefined) return <SkeletonList count={2} label={t.loading} />;
  if (team === null) return <p className="text-body">{t.noEmployerRole}</p>;
  const isAdmin = team.me.role === "admin";

  // The server has closed the employer identity. A full load of 我的 reads the session afresh (syncWithServer runs
  // once per load); changing the browser's copy here first would make EmployerGate send the person to sign-up.
  const leave = () =>
    run(
      () => changeMyTeam({ type: "leave" }),
      t.left,
      () => window.location.assign(new URL("/account", window.location.origin)),
    );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-title font-semibold">{t.title}</h1>
        {/* The business's name is its own words, so it leads the line in its own lang (ADR 0023). */}
        <p className="text-body text-muted">
          <span lang={contentLang(team.employer.name)}>{team.employer.name}</span>
          {t.intro(TEAM_MAX)}
        </p>
      </header>

      {message && (
        <p ref={messageRef} tabIndex={-1} role={message.ok ? "status" : "alert"} className={noticeClass(message.ok)}>
          {message.text}
        </p>
      )}

      <MyName
        key={team.me.name ?? ""}
        team={team}
        disabled={pending}
        onSave={(name) => run(() => setMyTeamName(name), t.nameSaved)}
      />

      <section aria-labelledby="team-members" className="space-y-2">
        <h2 id="team-members" className="font-semibold">
          {t.membersHeading(team.members.length)}
        </h2>
        <ul className="divide-y divide-border rounded-card bg-surface shadow-card">
          {team.members.map((member) => {
            const who = member.name ?? member.email;
            // 已把 <name> 设为管理员。 — the name is the person's own, so it carries its own lang.
            const said = (end: ReactNode) => (
              <>
                {t.changedBefore}
                <span lang={contentLang(who)}>{who}</span>
                {end}
              </>
            );
            return (
              <MemberRow
                key={member.email}
                member={member}
                mine={member.email === team.me.email}
                isAdmin={isAdmin}
                disabled={pending}
                onRole={(role) =>
                  run(() => changeMyTeam({ type: "role", email: member.email, role }), said(t.roleChanged(roles[role])))
                }
                onRemove={() => run(() => changeMyTeam({ type: "remove", email: member.email }), said(t.removed))}
                onLeave={leave}
              />
            );
          })}
        </ul>
      </section>

      {isAdmin && (
        <Invite
          team={team}
          disabled={pending}
          onInvite={(email, role) => run(() => inviteTeammate(email, role), t.invited(email))}
          onCancel={(id) => run(() => cancelTeamInvite(id), t.inviteCancelled)}
        />
      )}
    </div>
  );
}

function MyName({ team, disabled, onSave }: { team: MyTeam; disabled: boolean; onSave: (name: string) => void }) {
  const t = useMessages(employerTeamMessages).teamPage.myName;
  const [name, setName] = useState(team.me.name ?? "");
  const example = teamSignature(team.employer.name, name.trim() || t.exampleName);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(name);
  };
  return (
    <form
      onSubmit={submit}
      aria-labelledby="team-my-name"
      className="space-y-2 rounded-card bg-surface p-4 shadow-card"
    >
      <h2 id="team-my-name" className="font-semibold">
        {t.heading}
      </h2>
      {/* The example is the business's name with the name being typed: both are their own words. */}
      <p className="text-meta text-muted">
        {t.hintBefore}
        <span lang={contentLang(example)}>{example}</span>
        {t.hintAfter}
      </p>
      <label className="block space-y-1 text-body">
        <span>{t.nameLabel(TEAM_NAME_MAX)}</span>
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={TEAM_NAME_MAX} />
      </label>
      <Button type="submit" variant="secondary" {...busyProps(disabled)}>
        {t.save}
      </Button>
    </form>
  );
}

function MemberRow({
  member,
  mine,
  isAdmin,
  disabled,
  onRole,
  onRemove,
  onLeave,
}: {
  member: TeamMember;
  mine: boolean;
  isAdmin: boolean;
  disabled: boolean;
  onRole: (role: TeamMember["role"]) => void;
  onRemove: () => void;
  onLeave: () => void;
}) {
  const words = useMessages(employerTeamMessages);
  const t = words.teamPage.member;
  const role = words.team.roleLabel[member.role];
  const [confirming, setConfirming] = useState(false);
  const label = member.name ?? t.noName;
  return (
    <li aria-label={t.rowLabel(label, role)} className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          <span lang={contentLang(member.name)}>{label}</span>
          {mine && <span className="text-muted">{t.you}</span>}
        </p>
        <span className="text-meta text-muted">{role}</span>
      </div>
      <p className="text-meta break-all text-muted">{member.email}</p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            {...busyProps(disabled)}
            onClick={() => {
              setConfirming(false);
              if (mine) onLeave();
              else onRemove();
            }}
          >
            {mine ? t.confirmLeave : t.confirmRemove}
          </Button>
          <Button variant="link" onClick={() => setConfirming(false)}>
            {t.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {isAdmin && !mine && (
            <Button
              variant="link"
              onClick={() => onRole(member.role === "admin" ? "member" : "admin")}
              {...busyProps(disabled)}
            >
              {member.role === "admin" ? t.makeMember : t.makeAdmin}
            </Button>
          )}
          {isAdmin && mine && member.role === "admin" && (
            <Button variant="link" onClick={() => onRole("member")} {...busyProps(disabled)}>
              {t.makeMember}
            </Button>
          )}
          {(mine || isAdmin) && (
            <Button variant="link" onClick={() => setConfirming(true)} {...busyProps(disabled)}>
              {mine ? t.leave : t.remove}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function Invite({
  team,
  disabled,
  onInvite,
  onCancel,
}: {
  team: MyTeam;
  disabled: boolean;
  onInvite: (email: string, role: TeamMember["role"]) => void;
  onCancel: (id: string) => void;
}) {
  const words = useMessages(employerTeamMessages);
  const t = words.teamPage.invite;
  const roles = words.team.roleLabel;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("member");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onInvite(email.trim(), role);
    setEmail("");
  };
  return (
    <section aria-labelledby="team-invite" className="space-y-3">
      <h2 id="team-invite" className="font-semibold">
        {t.heading}
      </h2>
      <form onSubmit={submit} className="space-y-2 rounded-card bg-surface p-4 shadow-card">
        <p className="text-meta text-muted">{t.hint}</p>
        <label className="block space-y-1 text-body">
          <span>{t.emailLabel}</span>
          <input
            className={INPUT}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <fieldset className="flex flex-wrap gap-x-5 px-2 text-body">
          <legend className="-ml-2 mb-1">{t.roleLegend}</legend>
          {(["member", "admin"] as const).map((r) => (
            <Radio key={r} name="team-role" checked={role === r} onChange={() => setRole(r)}>
              {roles[r]}
            </Radio>
          ))}
        </fieldset>
        <Button type="submit" disabled={!email.trim()} {...busyProps(disabled)}>
          {t.send}
        </Button>
      </form>
      {team.invites.length > 0 && (
        <section aria-labelledby="team-pending" className="space-y-2">
          <h3 id="team-pending" className="text-body font-medium">
            {t.pendingHeading}
          </h3>
          <ul className="divide-y divide-border rounded-card bg-surface shadow-card">
            {team.invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="text-body break-all">
                  {t.pendingRow(invite.email, roles[invite.role])}
                  {/* #194: 14 days without an answer; it holds no place and cannot be accepted. */}
                  {invite.expired && <span className="ml-2 text-meta text-muted">{t.expired(INVITE_DAYS)}</span>}
                </span>
                <Button variant="link" onClick={() => onCancel(invite.id)} {...busyProps(disabled)}>
                  {t.cancel}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
