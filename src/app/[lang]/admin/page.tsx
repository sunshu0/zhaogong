import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModerationQueue } from "@/app/[lang]/admin/_components/ModerationQueue";
import { adminEnabled } from "@/app/[lang]/admin/enabled";
import { SignInGate } from "@/components/seeker/SignInGate";
import { adminMessages } from "@/i18n/messages/admin";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(adminMessages)).title, robots: { index: false, follow: false } };
}

// Read at build time for the static page: a build without ADMIN_ENABLED=1 (the deployed one) has no /admin.
// Round 19 (操作质感): the app's type; each item of a queue is a card.
export default async function AdminPage() {
  if (!adminEnabled()) notFound();
  const t = await messages(adminMessages);
  return (
    <div className="type-app space-y-4">
      <p role="note" className="text-meta text-muted">
        {t.whoBefore} <code>{t.whoCommand}</code> {t.whoAfter}
      </p>
      <SignInGate message={t.signInFor}>
        <ModerationQueue />
      </SignInGate>
    </div>
  );
}
