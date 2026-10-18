"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { setLang } from "@/i18n/actions";
import { useLang, useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/**
 * The interface language switch (Round 20, ADR 0023 §5): names the other language in that language. It sets the
 * zg_lang cookie (and the account's choice) and loads the whole page again, since Next keeps pages already seen and
 * prefetched data in the old language. `look="header"`: in the header from 768 px; `look="footer"`: the page's
 * footer, so phones and signed-out visitors can switch too; `look="row"`: a row of 我的, with the language now.
 */
export function LangSwitch({ look = "header" }: { look?: "header" | "footer" | "row" }) {
  const lang = useLang();
  const t = useMessages(uiMessages).langSwitch;
  const [pending, startTransition] = useTransition();
  const button = (
    <Button
      variant="link"
      title={t.title}
      loading={pending}
      className={look === "header" ? "hidden md:inline-flex" : undefined}
      onClick={() =>
        startTransition(async () => {
          await setLang(lang === "en" ? "zh" : "en");
          location.reload();
        })
      }
    >
      <span lang={t.otherTag}>{t.other}</span>
    </Button>
  );
  if (look !== "row") return button;
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-body">{t.row}</span>
      {button}
    </div>
  );
}
