// The five things an employer checks first about a job seeker, in one order and with one set of names everywhere:
// the job seeker's own preview (/profile), the candidate page (/candidates/[id]) and 推荐人才 cards (B28).
import { regionById } from "@/config/countries";
import type { Resume } from "@/lib/candidate-matching";

export type CandidateFact = { term: "可上班时间" | "地区" | "期望时薪" | "语言" | "经验"; value?: string };

type Source = { availability: string; location: string; languages: string; resume?: Resume };

export function candidateFacts({ availability, location, languages, resume }: Source): CandidateFact[] {
  const hours = resume?.hoursPerWeek ? `每周 ${resume.hoursPerWeek.min}–${resume.hoursPerWeek.max} 小时` : "";
  const regions = (resume?.regionIds ?? []).map((id) => regionById("NZ", id)?.nameZh ?? id).join("、");
  const years = resume?.experienceYears;
  return [
    { term: "可上班时间", value: [availability.trim(), hours].filter(Boolean).join(" · ") || undefined },
    { term: "地区", value: regions || location.trim() || undefined },
    { term: "期望时薪", value: resume?.expectedMinPay != null ? `$${resume.expectedMinPay} 起 / 小时` : undefined },
    { term: "语言", value: languages.trim() || undefined },
    { term: "经验", value: years == null ? undefined : years === 0 ? "暂无相关经验" : `${years} 年相关经验` },
  ];
}
