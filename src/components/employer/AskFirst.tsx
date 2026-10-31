"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useSwapFocus } from "@/components/ui/use-swap-focus";
import { useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/**
 * A text button that throws away what the employer wrote (清空重来, 不用粘贴，直接填表 over a filled form, 按表格重新生成
 * over an English description changed by hand). With `ask`, the press only asks: what goes, then 确定… and 取消,
 * in the button's place and with the focus (#189), never a dialog (UI review 1 B). Without, it acts at once.
 */
export function AskFirst({
  ask,
  question,
  confirmLabel,
  onConfirm,
  className,
  children,
}: {
  ask: boolean;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  className: string;
  children: ReactNode;
}) {
  const t = useMessages(employerPostMessages).askFirst;
  const [asking, setAsking] = useState(false);
  const { opener, form } = useSwapFocus<HTMLSpanElement, HTMLDivElement>(asking);
  if (asking)
    return (
      <div ref={form} role="group" aria-label={question} className="space-y-2">
        <p className="text-body">{question}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            onClick={() => {
              setAsking(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="link" onClick={() => setAsking(false)}>
            {t.cancel}
          </Button>
        </div>
      </div>
    );
  return (
    <span ref={opener} className="contents">
      <button type="button" onClick={() => (ask ? setAsking(true) : onConfirm())} className={className}>
        {children}
      </button>
    </span>
  );
}
