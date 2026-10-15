"use client";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { addModerator, getModerators, removeModerator, type AdminResult, type Refused } from "@/app/admin/actions";
import type { Moderator } from "@/db/moderators";
import { Empty } from "@/app/admin/_components/Empty";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

const day = new Intl.DateTimeFormat("zh-CN", { timeZone: "Pacific/Auckland", dateStyle: "medium" });

/** 审核员 (#50): who may moderate, and adding or removing one by email. The last moderator cannot be removed. */
export function ModeratorList({ onDone }: { onDone: (result: AdminResult) => void }) {
  const [answer, setAnswer] = useState<{ me: string; moderators: Moderator[] } | Refused>();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    getModerators().then((a) => {
      if (live) setAnswer(a);
    });
    return () => {
      live = false;
    };
  }, [version]);

  const run = (action: () => Promise<AdminResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      onDone(result);
      if (result.ok) after?.();
      reload();
    });

  const add = (event: FormEvent) => {
    event.preventDefault();
    run(
      () => addModerator(email),
      () => setEmail(""),
    );
  };

  if (!answer)
    return (
      <div className="-mx-4 h-40 animate-pulse border-y border-border bg-surface sm:mx-0 sm:rounded-md sm:border" />
    );
  if ("refused" in answer) return <Empty>{answer.error_zh}</Empty>;
  const only = answer.moderators.length <= 1;

  return (
    <div className="space-y-section">
      <Section
        title={`审核员 · ${answer.moderators.length} 位`}
        description="审核员可以处理被标记和被举报的职位、封禁雇主，也可以增删审核员。"
      >
        <ul className="divide-y divide-border">
          {answer.moderators.map((m) => (
            <li key={m.email} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">
                  {m.email}
                  {m.email === answer.me && <span className="ml-1.5 font-normal text-muted">（你）</span>}
                </p>
                <p className="text-meta text-muted">
                  {day.format(new Date(m.grantedAt))} {m.grantedBy ? `由${m.grantedBy}添加` : "在服务器上添加"}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={pending || only}
                title={only ? "至少要留一位审核员" : undefined}
                onClick={() => run(() => removeModerator(m.email))}
                className="shrink-0 text-danger"
                aria-label={`移除审核员 ${m.email}`}
              >
                移除
              </Button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="添加审核员">
        <form onSubmit={add} className="space-y-2 py-group">
          <label htmlFor="moderator-email" className="block text-body font-semibold">
            邮箱
          </label>
          <div className="flex gap-2">
            <input
              id="moderator-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="对方登录用的邮箱"
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-body"
            />
            <Button type="submit" disabled={pending || !email.trim()}>
              添加
            </Button>
          </div>
          <p className="text-meta text-muted">对方要先用这个邮箱登录过一次。</p>
        </form>
      </Section>
    </div>
  );
}
