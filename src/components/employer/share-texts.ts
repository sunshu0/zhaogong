// Ready-made posts for the places employers already advertise. No contact details: seekers follow
// the link, where contact shows after sign-in.
import { COUNTRIES, regionById } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, LANGUAGE_LABELS, VERIFICATION_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { Employer, Job } from "@/lib/types";
import { formatHours, formatPay, jobTags } from "@/components/seeker/format";

export type SharePlatform = "wechat" | "xiaohongshu" | "skykiwi";

export const SHARE_PLATFORMS: { key: SharePlatform; label: string; hint: string }[] = [
  { key: "wechat", label: "微信群", hint: "短一点，群里一眼能看完。" },
  { key: "xiaohongshu", label: "小红书", hint: "第一行做标题，话题标签放最后。" },
  { key: "skykiwi", label: "Skykiwi", hint: "论坛帖，中英文完整信息。" },
];

const AREA_ZH: Record<string, string> = { Auckland: "奥克兰" };

/** Joins lines, dropping the ones a condition left out (false / undefined); "" stays as a blank line. */
const lines = (...parts: (string | false | undefined)[]) => parts.filter((p) => typeof p === "string").join("\n");

export function shareTexts(job: Job, employer: Employer | undefined, url: string): Record<SharePlatform, string> {
  const country = COUNTRIES[job.country];
  const region = regionById(job.country, job.regionId);
  const area = (region && AREA_ZH[region.area]) ?? country.nameZh;
  const pay = formatPay(job.pay, job.country);
  const type = EMPLOYMENT_TYPE_LABELS[job.employmentType].zh;
  const hours = formatHours(job.hoursPerWeek);
  const tags = jobTags(job);
  const badge = employer && employer.verification !== "unverified" ? `（${VERIFICATION_LABELS[employer.verification].zh}）` : "";
  const by = employer ? ` · ${employer.name}${badge}` : "";
  const perks = [job.mealsIncluded && "包餐", job.accommodationIncluded && "包住"].filter(Boolean).join("、");
  const languages = job.languages.map((l) => LANGUAGE_LABELS[l].zh).join("、");
  const visas = job.visaAccepted.map((v) => VISA_LABELS[v].zh).join("、");

  const wechat = lines(
    `【招聘】${job.titleZh}${by}`,
    !!region && `📍 ${region.nameZh}`,
    `💰 ${[pay, type, hours].filter(Boolean).join(" · ")}`,
    !!job.shiftsZh && `🕒 ${job.shiftsZh}`,
    tags.length > 0 && `✅ ${tags.join(" · ")}`,
    `👉 详情和联系方式：${url}`,
  );

  const hashtags = [
    `#${area}找工作`,
    `#${area}${type}`,
    job.industry !== "other" && `#${area}${INDUSTRY_LABELS[job.industry].zh}`,
    job.visaAccepted.includes("student") && "#留学生兼职",
    job.visaAccepted.includes("working_holiday") && `#${country.nameZh}打工度假`,
  ].filter(Boolean);
  const xiaohongshu = lines(
    `${area}招聘｜${job.titleZh} ${pay}`,
    "",
    `${employer?.name ?? ""}招${job.titleZh}，${[type, hours, job.shiftsZh].filter(Boolean).join("，")}。`,
    `💰 时薪 ${pay.replace("/小时", "")}`,
    !!region && `📍 ${region.nameZh}`,
    tags.length > 0 && `✅ ${tags.join(" · ")}`,
    "职位详情和联系方式看链接👇",
    url,
    "",
    hashtags.join(" "),
  );

  const skykiwi = lines(
    `[招聘] ${job.titleZh} ${job.titleEn} — ${region?.nameZh ?? area} — ${pay}`,
    "",
    !!employer && `雇主：${employer.name}${badge}`,
    `工作类型：${[type, hours, job.shiftsZh].filter(Boolean).join("，")}`,
    `时薪：${pay}`,
    `地区：${[region?.nameZh, job.address].filter(Boolean).join("，")}`,
    !!perks && `福利：${perks}`,
    !!languages && `语言：${languages}`,
    !!visas && `雇主注明可接受的签证：${visas}`,
    job.urgent && "急招",
    "",
    "职位描述：",
    job.descriptionZh,
    "",
    "Job description:",
    job.descriptionEn,
    "",
    `详情和联系方式：${url}`,
  );

  return { wechat, xiaohongshu, skykiwi };
}
