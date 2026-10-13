"use client";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import type { Employer, Job } from "@/lib/types";
import { CopyButton } from "@/components/seeker/CopyButton";
import { SHARE_PLATFORMS, shareTexts, type SharePlatform } from "@/components/employer/share-texts";
import { TabList, TabPanel } from "@/components/employer/Tabs";

const noop = () => () => {};

/** Ready-made posts for WeChat groups, Xiaohongshu and Skykiwi, each with the job link. */
export function ShareTexts({ job, employer }: { job: Job; employer?: Employer }) {
  const [platform, setPlatform] = useState<SharePlatform>("wechat");
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const texts = useMemo(() => shareTexts(job, employer, `${origin}/jobs/${job.id}`), [job, employer, origin]);
  const current = SHARE_PLATFORMS.find((p) => p.key === platform)!;
  const id = useId();

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-medium">发到其他平台</h2>
      <TabList
        label="平台"
        idBase={id}
        tabs={SHARE_PLATFORMS.map((p) => ({ key: p.key, label: p.label }))}
        value={platform}
        onChange={setPlatform}
        className="flex gap-2"
        tabClassName={(selected) =>
          `h-9 flex-1 rounded-full text-sm ${selected ? "bg-brand text-white" : "border border-border text-muted"}`
        }
      />
      <TabPanel idBase={id} value={platform} className="space-y-2">
        <p className="text-xs text-muted">{current.hint}文案里没有联系方式，求职者点链接查看。</p>
        <textarea
          readOnly
          value={texts[platform]}
          rows={platform === "wechat" ? 7 : 12}
          aria-label={`${current.label}文案`}
          className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed"
        />
        <CopyButton text={texts[platform]} label={`复制${current.label}文案`} size="md" className="w-full" />
      </TabPanel>
    </section>
  );
}
