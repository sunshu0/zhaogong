"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { TEAM_NAME_MAX, TEAM_ROLE_LABEL } from "@/components/employer/team";
import { answerTeamInvite, getMyTeamInvites, type MyTeamInvite } from "@/app/[lang]/employer/team-actions";
import { setIdentity } from "@/components/seeker/session-client";

const INPUT = "h-11 w-full rounded-control border border-border bg-surface px-3";

/**
 * 团队邀请 on 我的 (#87): businesses that invited this account. Accepting, with the name the team will see, opens the
 * employer identity for that business and goes to its 团队 page. Nothing shows without invitations.
 */
export function TeamInvites({ email }: { email: string }) {
  const [invites, setInvites] = useState<{ email: string; list: MyTeamInvite[] }>();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let live = true;
    getMyTeamInvites().then((list) => {
      if (live) setInvites({ email, list });
    });
    return () => {
      live = false;
    };
  }, [email, version]);

  const list = invites?.email === email ? invites.list : [];
  if (!list.length) return null;

  const answer = (id: string, accept: boolean, name = "") =>
    startTransition(async () => {
      const result = await answerTeamInvite(id, accept ? { accept, name } : { accept }).catch(() => null);
      if (!result) return setError("网络有问题，请稍后再试。");
      if (!result.ok) {
        setError(result.error_zh);
        return setVersion((v) => v + 1);
      }
      setError(undefined);
      if (result.employer) {
        setIdentity({ activeRole: "employer", employer: result.employer });
        router.push("/employer/team");
      } else setVersion((v) => v + 1);
    });

  return (
    <section id="team-invites" aria-labelledby="team-invites-title">
      <Section>
        <div className="space-y-3 py-group">
          <h2 id="team-invites-title" className="font-semibold">
            团队邀请
          </h2>
          {error && (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          )}
          {list.map((invite) => (
            <InviteCard
              key={invite.id}
              invite={invite}
              disabled={pending}
              onAccept={(name) => answer(invite.id, true, name)}
              onDecline={() => answer(invite.id, false)}
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
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAccept(name);
  };
  return (
    <form
      onSubmit={submit}
      aria-label={`${invite.employerName} 的邀请`}
      className="space-y-2 rounded-card bg-surface p-4 shadow-card"
    >
      <p className="text-body">
        <span className="font-medium">{invite.employerName}</span> 邀请你加入团队，做{TEAM_ROLE_LABEL[invite.role]}
        。加入后可以切换到雇主身份，为这家店发职位、处理申请和回复聊天。
      </p>
      <label className="block space-y-1 text-body">
        <span>你在团队里的称呼（例如「王经理」，最多 {TEAM_NAME_MAX} 个字）</span>
        <input
          className={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TEAM_NAME_MAX}
          required
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled || !name.trim()}>
          接受并加入
        </Button>
        <Button variant="link" disabled={disabled} onClick={onDecline}>
          婉拒
        </Button>
      </div>
    </form>
  );
}
