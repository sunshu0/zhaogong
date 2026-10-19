"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/input-class";
import { busyProps } from "@/components/ui/busy";
import { TEAM_NAME_MAX } from "@/components/employer/team";
import { useMessages } from "@/i18n/client";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { joinTeamWithLink } from "@/app/[lang]/employer/team-actions";
import { setIdentity } from "@/components/seeker/session-client";

const INPUT = inputClass();

/**
 * 加入团队 with an invitation link (#349, ADR 0028), signed in: the name the team will see, then 加入团队. The server
 * checks the link again; joining opens the employer identity for the business and goes to its 团队 page, as accepting
 * an invitation on 我的 does.
 */
export function TeamJoin({ token, email }: { token: string; email: string }) {
  const t = useMessages(employerTeamMessages).teamJoin;
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await joinTeamWithLink(token, name).catch(() => null);
      if (!result) return setError(t.networkError);
      if (!result.ok) return setError(result.error_zh);
      if (result.employer) setIdentity({ activeRole: "employer", employer: result.employer });
      router.push("/employer/team");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-meta break-all text-muted">{t.signedInAs(email)}</p>
      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
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
      <Button type="submit" block disabled={!name.trim()} {...busyProps(pending)}>
        {t.join}
      </Button>
    </form>
  );
}
