import type { Metadata } from "next";
import Link from "next/link";
import { MyJobs } from "@/components/employer/MyJobs";

export const metadata: Metadata = {
  title: "雇主发布招聘",
  description: "粘贴一段招聘消息，一分钟整理成中英文职位，发布前自动检查是否合规。",
};

const POINTS = [
  "粘贴微信群里的招聘消息，自动整理成中英文职位",
  "发布前自动检查最低工资和违规用词，求职者更放心",
  "一键复制到 Skykiwi、小红书和微信群，带职位链接",
];

export default function EmployerHome() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-brand-soft px-4 py-5">
        <h1 className="text-xl font-semibold leading-snug">招中文员工，一分钟发好招聘</h1>
        <ul className="mt-3 space-y-2">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-2 text-sm leading-relaxed">
              <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-1 size-3.5 shrink-0 fill-brand">
                <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5.3-5.3 1.1 1.1z" />
              </svg>
              {point}
            </li>
          ))}
        </ul>
        <Link
          href="/employer/post"
          className="mt-5 flex h-14 w-full items-center justify-center rounded-xl bg-brand text-lg font-semibold text-white shadow-sm hover:opacity-90"
        >
          一分钟发布招聘
        </Link>
        <p className="mt-2 text-center text-xs text-muted">用邮箱开通雇主身份，不用设密码，开通后马上开始写。</p>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">我的职位</h2>
        <MyJobs />
      </section>

      <section className="grid grid-cols-2 gap-3 text-sm">
        <Link href="/employer/jobs" className="rounded-xl border border-border bg-surface p-4 hover:border-brand/40">
          <span className="font-medium">管理职位</span>
          <span className="mt-1 block text-xs text-muted">编辑、刷新、关闭</span>
        </Link>
        <Link href="/employer/verify" className="rounded-xl border border-border bg-surface p-4 hover:border-brand/40">
          <span className="font-medium">企业验证</span>
          <span className="mt-1 block text-xs text-muted">显示「已验证企业」标识</span>
        </Link>
      </section>
    </div>
  );
}
