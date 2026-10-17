import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { LinkList } from "@/components/ui/LinkList";
import { Section } from "@/components/ui/Section";

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
    <div className="space-y-section">
      <section className="space-y-4 py-2">
        <h1 className="text-title font-semibold">招中文员工，一分钟发好招聘</h1>
        <ul className="space-y-2">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-2 text-body">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
              {point}
            </li>
          ))}
        </ul>
        <div>
          <ButtonLink href="/employer/post" block size="lg">
            一分钟发布招聘
          </ButtonLink>
          <p className="mt-2 text-center text-meta text-muted">用邮箱开通雇主身份，不用设密码，开通后马上开始写。</p>
        </div>
      </section>

      <Section look="app">
        <LinkList
          label="雇主常用"
          items={[
            { href: "/employer/jobs", label: "职位管理", detail: "编辑、刷新、关闭" },
            { href: "/employer/verify", label: "企业验证", detail: "显示「已验证企业」标识" },
          ]}
        />
      </Section>
    </div>
  );
}
