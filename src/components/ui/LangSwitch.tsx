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
      onClick={() =>
        startTransition(async () => {
          const hash = location.hash;
          await setLang(lang === "en" ? "zh" : "en");
          // The cookie set in the answer makes Next refresh the page, which can drop a #hash from the address (#90):
          // put it back, so the reload comes back to the same place.
          if (hash && location.hash !== hash) history.replaceState(history.state, "", hash);
          location.reload();
        })
      }
    >
      <span lang={t.otherTag}>{t.other}</span>
    </Button>
  );
  // In the header from 768 px only. The wrapper hides it: on the button itself, `hidden` loses to Button's own
  // inline-flex.
  if (look === "header") return <span className="hidden md:inline-flex">{button}</span>;
  if (look === "footer") return button;
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-body">{t.row}</span>
      {button}
    </div>
  );
}
