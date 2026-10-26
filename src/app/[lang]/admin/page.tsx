import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModerationQueue } from "@/app/[lang]/admin/_components/ModerationQueue";
import { adminEnabled } from "@/app/[lang]/admin/enabled";
import { NotForStaff } from "@/components/account/staff";
import { SignInGate } from "@/components/seeker/SignInGate";
import { adminMessages } from "@/i18n/messages/admin";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(adminMessages)).title, robots: { index: false, follow: false } };
}

// Read at build time for the static page: a build without ADMIN_ENABLED=1 (the deployed one) has no /admin.
// Round 19 (操作质感): the app's type; visual A (#398): each item of a queue is a sheet.
export default async function AdminPage() {
  if (!adminEnabled()) notFound();
  const t = await messages(adminMessages);
  return (
    <div className="type-app space-y-4">
      {/* ADR 0043: how one becomes a moderator, for whoever is not one; a staff account knows. */}
      <NotForStaff>
        <p role="note" className="text-meta text-muted">
          {t.whoBefore} <code>{t.whoCommand}</code> {t.whoAfter}
        </p>
      </NotForStaff>
      <SignInGate message={t.signInFor}>
        <ModerationQueue />
      </SignInGate>
    </div>
  );
}
