"use client";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Checkbox";
import { SkeletonList } from "@/components/ui/Skeleton";
import { noticeClass } from "@/components/employer/app-style";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { useMyTeam } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { TEAM_MAX, TEAM_NAME_MAX, TEAM_ROLE_LABEL, teamSignature, type TeamMember } from "@/components/employer/team";
import {
  cancelTeamInvite,
  changeMyTeam,
  inviteTeammate,
  setMyTeamName,
  type MyTeam,
} from "@/app/employer/team-actions";

const INPUT = "h-11 w-full rounded-control border border-border bg-surface px-3";

type Done = { ok: true } | { ok: false; error_zh: string };

/**
 * 团队 (#87, PRD R-38): who works for the business. Admins invite by email, change roles and remove people; anyone
 * sets the name the team sees on their replies, or leaves. The server checks every change.
 */
export function TeamPage() {
  return <EmployerGate next="/employer/team">{(me) => <Team me={me} />}</EmployerGate>;
}

function Team({ me }: { me: EmployerIdentity }) {
  const { team, reload } = useMyTeam(me.email);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const messageRef = useFocusOnChange<HTMLParagraphElement>(message);
  const [pending, startTransition] = useTransition();

  /** Runs one change on the server, says how it went, and reloads the team. */
  const run = (action: () => Promise<Done>, okText: string, after?: () => void) =>
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false as const, error_zh: "网络有问题，请稍后再试。" }));
      setMessage(result.ok ? { ok: true, text: okText } : { ok: false, text: result.error_zh });
      if (result.ok) (after ?? reload)();
    });

  if (team === undefined) return <SkeletonList count={2} label="正在读取团队" />;
  if (team === null) return <p className="text-body">需要先开通雇主身份。</p>;
  const isAdmin = team.me.role === "admin";

  // The server has closed the employer identity. A full load of 我的 reads the session afresh (syncWithServer runs
  // once per load); changing the browser's copy here first would make EmployerGate send the person to sign-up.
  const leave = () =>
    run(
      () => changeMyTeam({ type: "leave" }),
      "你已退出团队。",
      () => window.location.assign(new URL("/account", window.location.origin)),
    );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-title font-semibold">团队</h1>
        <p className="text-body text-muted">
          {team.employer.name} 的团队，最多 {TEAM_MAX}{" "}
          人。成员可以发职位、管理职位、处理申请和回复聊天；管理员还能管理团队和申请企业验证。
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
        onSave={(name) => run(() => setMyTeamName(name), "称呼已保存。")}
      />

      <section aria-labelledby="team-members" className="space-y-2">
        <h2 id="team-members" className="font-semibold">
          成员（{team.members.length}）
        </h2>
        <ul className="divide-y divide-border rounded-card bg-surface shadow-card">
          {team.members.map((member) => (
            <MemberRow
              key={member.email}
              member={member}
              mine={member.email === team.me.email}
              isAdmin={isAdmin}
              disabled={pending}
              onRole={(role) =>
                run(
                  () => changeMyTeam({ type: "role", email: member.email, role }),
                  `已把 ${member.name ?? member.email} 设为${TEAM_ROLE_LABEL[role]}。`,
                )
              }
              onRemove={() =>
                run(
                  () => changeMyTeam({ type: "remove", email: member.email }),
                  `已把 ${member.name ?? member.email} 移出团队。`,
                )
              }
              onLeave={leave}
            />
          ))}
        </ul>
      </section>

      {isAdmin && (
        <Invite
          team={team}
          disabled={pending}
          onInvite={(email, role) =>
            run(() => inviteTeammate(email, role), `已邀请 ${email}，对方在「我的」里接受后加入。`)
          }
          onCancel={(id) => run(() => cancelTeamInvite(id), "邀请已撤回。")}
        />
      )}
    </div>
  );
}

function MyName({ team, disabled, onSave }: { team: MyTeam; disabled: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(team.me.name ?? "");
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
        我的称呼
      </h2>
      <p className="text-meta text-muted">
        团队里的人在聊天里能看到每条回复是谁发的，例如「{teamSignature(team.employer.name, name.trim() || "王经理")}」。
      </p>
      <label className="block space-y-1 text-body">
        <span>称呼（最多 {TEAM_NAME_MAX} 个字）</span>
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={TEAM_NAME_MAX} />
      </label>
      <Button type="submit" variant="secondary" disabled={disabled}>
        保存称呼
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
  const [confirming, setConfirming] = useState(false);
  const label = member.name ?? "（还没有称呼）";
  return (
    <li aria-label={`${label}，${TEAM_ROLE_LABEL[member.role]}`} className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {label}
          {mine && <span className="text-muted">（你）</span>}
        </p>
        <span className="text-meta text-muted">{TEAM_ROLE_LABEL[member.role]}</span>
      </div>
      <p className="text-meta break-all text-muted">{member.email}</p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => {
              setConfirming(false);
              if (mine) onLeave();
              else onRemove();
            }}
          >
            {mine ? "确认退出" : "确认移除"}
          </Button>
          <Button variant="link" onClick={() => setConfirming(false)}>
            取消
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {isAdmin && !mine && (
            <Button
              variant="link"
              disabled={disabled}
              onClick={() => onRole(member.role === "admin" ? "member" : "admin")}
            >
              {member.role === "admin" ? "改为成员" : "设为管理员"}
            </Button>
          )}
          {isAdmin && mine && member.role === "admin" && (
            <Button variant="link" disabled={disabled} onClick={() => onRole("member")}>
              改为成员
            </Button>
          )}
          {(mine || isAdmin) && (
            <Button variant="link" disabled={disabled} onClick={() => setConfirming(true)}>
              {mine ? "退出团队" : "移出团队"}
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
        邀请成员
      </h2>
      <form onSubmit={submit} className="space-y-2 rounded-card bg-surface p-4 shadow-card">
        <p className="text-meta text-muted">
          对方要先用这个邮箱登录过找工，并且还没有自己的企业。对方在「我的」里接受后加入。
        </p>
        <label className="block space-y-1 text-body">
          <span>对方的邮箱</span>
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
          <legend className="-ml-2 mb-1">身份</legend>
          {(["member", "admin"] as const).map((r) => (
            <Radio key={r} name="team-role" checked={role === r} onChange={() => setRole(r)}>
              {TEAM_ROLE_LABEL[r]}
            </Radio>
          ))}
        </fieldset>
        <Button type="submit" disabled={disabled || !email.trim()}>
          发送邀请
        </Button>
      </form>
      {team.invites.length > 0 && (
        <section aria-labelledby="team-pending" className="space-y-2">
          <h3 id="team-pending" className="text-body font-medium">
            等对方回复
          </h3>
          <ul className="divide-y divide-border rounded-card bg-surface shadow-card">
            {team.invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="text-body break-all">
                  {invite.email} · {TEAM_ROLE_LABEL[invite.role]}
                </span>
                <Button variant="link" disabled={disabled} onClick={() => onCancel(invite.id)}>
                  撤回邀请
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
