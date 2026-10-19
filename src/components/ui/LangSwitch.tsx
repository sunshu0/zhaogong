"use client";

import { useState, useTransition } from "react";
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
  const [failed, setFailed] = useState(false);
  const button = (
    <Button
      variant="link"
      title={t.title}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const hash = location.hash;
          setFailed(false);
          // No answer (offline, the server restarting): the page stays as it is and says so beside the switch,
          // instead of the error page in its place (#251).
          if (
            !(await setLang(lang === "en" ? "zh" : "en").then(
              () => true,
              () => false,
            ))
          )
            return setFailed(true);
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
  const said = failed && (
    <span role="alert" className="text-meta text-danger">
      {t.noAnswer}
    </span>
  );
  // In the header from 768 px only. The wrapper hides it: on the button itself, `hidden` loses to Button's own
  // inline-flex.
  if (look === "header")
    return (
      <span className="hidden items-center gap-2 md:inline-flex">
        {button}
        {said}
      </span>
    );
  if (look === "footer")
    return said ? (
      <span className="inline-flex flex-wrap items-center gap-2">
        {button}
        {said}
      </span>
    ) : (
      button
    );
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-body">{t.row}</span>
      <span className="flex flex-wrap items-center justify-end gap-2">
        {said}
        {button}
      </span>
    </div>
  );
}
