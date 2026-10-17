import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModerationQueue } from "@/app/admin/_components/ModerationQueue";
import { adminEnabled } from "@/app/admin/enabled";
import { SignInGate } from "@/components/seeker/SignInGate";

export const metadata: Metadata = { title: "审核后台", robots: { index: false, follow: false } };

// Read at build time for the static page: a build without ADMIN_ENABLED=1 (the deployed one) has no /admin.
// Round 19 (操作质感): the app's type; each item of a queue is a card.
export default function AdminPage() {
  if (!adminEnabled()) notFound();
  return (
    <div className="type-app space-y-4">
      <p role="note" className="text-meta text-muted">
        只有审核员能使用审核后台。第一位审核员在服务器上用 <code>npm run admin:grant 邮箱</code>{" "}
        添加，之后由审核员在「审核员」一页里增删。
      </p>
      <SignInGate message="登录后进入审核后台">
        <ModerationQueue />
      </SignInGate>
    </div>
  );
}
