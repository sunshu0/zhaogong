import { connection } from "next/server";
import { Suspense } from "react";
import { takedownEmail } from "@/config/external-companies";
import { externalMessages } from "@/i18n/messages/external";
import { messages } from "@/i18n/server";

/** 公司要求删除 (Round 18 draft 3.7): under every external job page, how a company has its jobs taken down. */
export async function TakedownNote() {
  const t = (await messages(externalMessages)).takedown;
  return (
    <section aria-labelledby="takedown-heading" className="space-y-1 border-t border-border pt-4 text-meta text-muted">
      <h2 id="takedown-heading" className="font-medium text-foreground">
        {t.heading}
      </h2>
      <p>{t.text}</p>
      <Suspense fallback={<p className="h-5" />}>
        <Address />
      </Suspense>
    </section>
  );
}

async function Address() {
  await connection(); // read at request time, not baked into the build
  const email = takedownEmail();
  const t = (await messages(externalMessages)).takedown;
  return email ? (
    <p>
      {t.email}
      <a href={`mailto:${email}`} className="text-brand underline underline-offset-2">
        {email}
      </a>
      {t.emailNote}
    </p>
  ) : (
    <p>{t.emailLater}</p>
  );
}
