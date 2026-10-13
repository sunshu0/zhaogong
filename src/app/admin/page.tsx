import type { Metadata } from "next";
import { ModerationQueue } from "@/app/admin/_components/ModerationQueue";

export const metadata: Metadata = { title: "审核后台（演示）", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <p role="note" className="rounded-lg border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
        <span className="font-semibold">演示后台</span> ·
        这一版没有管理员登录，只用来演示审核流程。正式版只有审核人员能打开。
      </p>
      <ModerationQueue />
    </div>
  );
}
