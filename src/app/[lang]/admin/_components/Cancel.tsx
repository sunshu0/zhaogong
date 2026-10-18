"use client";

import type { ButtonHTMLAttributes } from "react";
import { useMessages } from "@/i18n/client";
import { adminMessages } from "@/i18n/messages/admin";

/** 取消 beside a confirming step: a quiet grey text button, 44px high, that answers a press. */
export function Cancel(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className">) {
  const t = useMessages(adminMessages);
  return (
    <button
      type="button"
      className="pressable min-h-11 rounded-control px-3 text-body text-muted underline underline-offset-2 hover:text-foreground"
      {...props}
    >
      {t.cancel}
    </button>
  );
}
