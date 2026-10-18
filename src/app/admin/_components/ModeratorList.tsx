"use client";
import { useCallback, useState, useTransition, type FormEvent } from "react";
import { addModerator, getModerators, removeModerator, type AdminResult, type Refused } from "@/app/admin/actions";
import type { Moderator } from "@/db/moderators";
import { isFailed, settle } from "@/app/admin/load-state";
import { Empty, Loading } from "@/app/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/admin/_components/Failed";
import { useAdminLoad } from "@/app/admin/_components/use-admin-load";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { inputClass } from "@/components/ui/input-class";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

/** Who added a moderator: another moderator, the command line (null), or an account deleted since (#54). */
function grantedByText(grantedBy: string | null): string {
  if (!grantedBy) return "在服务器上添加";
  return grantedBy === DELETED_ACCOUNT ? "由已删除的账号添加" : `由${grantedBy}添加`;
}

const day = new Intl.DateTimeFormat("zh-CN", { timeZone: "Pacific/Auckland", dateStyle: "medium" });

/** 审核员 (#50): who may moderate, and adding or removing one by email. The last moderator cannot be removed. */
export function ModeratorList({ onDone }: { onDone: (result: AdminResult) => void }) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const answer = useAdminLoad<{ me: string; moderators: Moderator[] } | Refused>(getModerators, version);
  // #183: where an action got no answer — the list (a removal) or the form (an addition, the email stays).
  const [failed, setFailed] = useState<"list" | "add">();

  const run = (where: "list" | "add", action: () => Promise<AdminResult>, after?: () => void) => {
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

  if (isFailed(answer)) return <LoadFailed what="审核员名单" onRetry={reload} />;
  if (!answer) return <Loading />;
  if ("refused" in answer) return <Empty>{answer.error_zh}</Empty>;
  const only = answer.moderators.length <= 1;

  return (
    <div className="space-y-section">
      <Section
        look="app"
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
                  {day.format(new Date(m.grantedAt))} {grantedByText(m.grantedBy)}
                </p>
              </div>
              <Button
                variant="danger-secondary"
                disabled={pending || only}
                title={only ? "至少要留一位审核员" : undefined}
                onClick={() => run("list", () => removeModerator(m.email))}
                className="shrink-0"
                aria-label={`移除审核员 ${m.email}`}
              >
                移除
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
      <Section look="app" title="添加审核员">
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
              className={`${inputClass()} min-w-0 flex-1`}
            />
            <Button type="submit" disabled={!email.trim()} loading={pending}>
              添加
            </Button>
          </div>
          <p className="text-meta text-muted">对方要先用这个邮箱登录过一次。</p>
          {failed === "add" && <TryAgain />}
        </form>
      </Section>
    </div>
  );
}
