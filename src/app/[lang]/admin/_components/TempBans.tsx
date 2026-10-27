"use client";
import { useCallback, useState, useTransition } from "react";
import {
  getTempBans,
  liftEmployerTempBan,
  makeEmployerBanPermanent,
  type AdminResult,
  type Refused,
  type TempBan,
} from "@/app/[lang]/admin/actions";
import { isFailed } from "@/app/[lang]/admin/load-state";
import { Cancel } from "@/app/[lang]/admin/_components/Cancel";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { StartChatButton } from "@/app/[lang]/admin/_components/ModeratorChats";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { adminMessages } from "@/i18n/messages/admin";

const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

/**
 * 暂时封禁 (ADR 0044): the businesses under a temporary ban now, soonest end first — until when, why, who banned them —
 * with 提前解除 and 改成永久. A ban that is over leaves the list by itself.
 */
export function TempBans({
  onDone,
  onChat,
}: {
  onDone: (result: AdminResult) => void;
  /** 和企业聊天 opened the business's conversation (ADR 0046). */
  onChat: (employerId: string) => void;
}) {
  const lang = useLang();
  const t = useMessages(adminMessages).tempBans;
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const answer = useAdminLoad<TempBan[] | Refused>(getTempBans, version);
  const [pending, start] = useTransition();
  const [pressed, setPressed] = useState<string>();
  const [confirming, setConfirming] = useState<string>();

  if (isFailed(answer)) return <LoadFailed what={t.listName} onRetry={reload} />;
  if (!answer) return <Loading cards={1} />;
  if ("refused" in answer) return <Empty>{answer.error_zh}</Empty>;

  const act = (key: string, action: () => Promise<AdminResult>) => {
    setPressed(key);
    start(async () => {
      onDone(await action());
      setConfirming(undefined);
      reload();
    });
  };

  return (
    <Section look="sheet" title={t.title} description={t.description}>
      {answer.length === 0 ? (
        <p className="py-group text-body text-muted">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {answer.map((b) => (
            <li key={b.employerId} className="space-y-2 py-3 text-body">
              <p>
                <span lang={contentLang(b.employerName)} className="font-medium">
                  {b.employerName}
                </span>{" "}
                <span className="text-muted">{t.until(formatDate(b.until, lang, TIME))}</span>
              </p>
              <p className="break-words">{t.reason(b.reason)}</p>
              {b.by && <p className="text-meta text-muted break-all">{t.by(b.by)}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={pending && pressed !== `lift-${b.employerId}`}
                  loading={pending && pressed === `lift-${b.employerId}`}
                  onClick={() => act(`lift-${b.employerId}`, () => liftEmployerTempBan(b.employerId))}
                >
                  {t.lift}
                </Button>
                {confirming === b.employerId ? (
                  <>
                    <Button
                      variant="danger"
                      disabled={pending && pressed !== `perm-${b.employerId}`}
                      loading={pending && pressed === `perm-${b.employerId}`}
                      onClick={() => act(`perm-${b.employerId}`, () => makeEmployerBanPermanent(b.employerId))}
                    >
                      {t.confirmPermanent(b.employerName)}
                    </Button>
                    <Cancel onClick={() => setConfirming(undefined)} />
                  </>
                ) : (
                  <Button variant="danger-secondary" onClick={() => setConfirming(b.employerId)}>
                    {t.makePermanent}
                  </Button>
                )}
                <StartChatButton employerId={b.employerId} from="temp_ban" onOpen={onChat} onDone={onDone} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
