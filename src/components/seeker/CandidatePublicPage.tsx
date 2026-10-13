"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { useCandidateDirectory } from "@/components/seeker/hub-client";
import { useChat } from "@/components/seeker/chat-client";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { AvatarImage } from "@/components/seeker/ProfileAvatar";

export function CandidatePublicPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const session = useSession();
  const candidates = useCandidateDirectory();
  const { conversations } = useChat();
  const candidate = candidates.find((item) => item.id === id && item.resume.discoverable);
  const conversation = session?.activeRole === "employer" ? conversations.find((item) => ("candidateId" in item && item.candidateId === id) || item.id === id || item.id.startsWith(`recommend:${id}:`)) : undefined;
  const backHref = conversation ? `/messages?conversation=${encodeURIComponent(conversation.id)}` : "/messages";
  const back = <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm text-brand"><ArrowLeft aria-hidden="true" className="size-4" />返回聊天</Link>;
  if (!hydrated) return <p role="status" className="py-8 text-sm text-muted">正在加载主页…</p>;
  if (!candidate) return <div className="space-y-4">{back}<h1 className="text-2xl font-semibold">求职主页暂不可查看</h1><p className="text-sm text-muted">该求职者尚未公开资料或已关闭公开主页。</p></div>;
  const { resume } = candidate;
  return <div className="space-y-6">
    {back}
    <header className="flex items-start gap-4 border-b border-border pb-6">
      <AvatarImage avatar={candidate.avatar} fallback={candidate.name} alt={`${candidate.name}头像`} large />
      <div className="min-w-0"><p className="text-xs text-muted">求职者主页{candidate.source === "demo" ? " · 演示资料" : ""}</p><h1 className="mt-1 break-words text-2xl font-semibold">{candidate.name}</h1><p className="mt-2 break-words text-sm">{candidate.headline || "求职意向待补充"}</p><p className="mt-2 flex items-center gap-1 text-sm text-muted"><MapPin aria-hidden="true" className="size-4 shrink-0" />{candidate.location || "地区待补充"}</p></div>
    </header>
    <section aria-labelledby="candidate-about" className="space-y-3"><h2 id="candidate-about" className="text-lg font-semibold">个人介绍</h2><p className="whitespace-pre-line break-words text-sm leading-relaxed">{candidate.bio || "尚未填写个人介绍。"}</p></section>
    <section aria-labelledby="candidate-preferences" className="space-y-4 border-t border-border pt-5"><h2 id="candidate-preferences" className="text-lg font-semibold">公开求职资料</h2><dl className="grid gap-5 text-sm sm:grid-cols-2">
      <Info term="技能" value={resume.skills} />
      <Info term="相关岗位经验" value={resume.experienceYears != null ? `${resume.experienceYears} 年` : undefined} />
      <Info term="沟通语言" value={candidate.languages} />
      <Info term="可工作时间" value={candidate.availability} />
      <Info term="用工形式" value={formatEmploymentTypes(resume.employmentTypes)} />
      <Info term="工作地区" value={resume.regionIds.map((region) => regionById("NZ", region)?.nameZh ?? region).join("、")} />
      <Info term="每周工时" value={resume.hoursPerWeek ? `${resume.hoursPerWeek.min}–${resume.hoursPerWeek.max} 小时` : undefined} />
      <Info term="期望最低时薪" value={resume.expectedMinPay != null ? `$${resume.expectedMinPay} / 小时` : undefined} />
    </dl></section>
  </div>;
}

function Info({ term, value }: { term: string; value?: string }) {
  return <div><dt className="text-xs text-muted">{term}</dt><dd className="mt-1 whitespace-pre-line break-words">{value?.trim() || "待补充"}</dd></div>;
}
