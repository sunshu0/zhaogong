"use client";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import type { Employer, Job } from "@/lib/types";
import { CopyButton } from "@/components/seeker/CopyButton";
import { SHARE_PLATFORMS, shareTexts, type SharePlatform } from "@/components/employer/share-texts";
import { TabList, TabPanel, pillTab } from "@/components/employer/Tabs";
import { useMessages } from "@/i18n/client";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

const noop = () => () => {};

/** Ready-made posts for WeChat groups, Xiaohongshu and Skykiwi, each with the job link. */
export function ShareTexts({ job, employer }: { job: Job; employer?: Employer }) {
  // The posts themselves stay Chinese (share-texts.ts); only the interface around them follows the language.
  const t = useMessages(employerJobsMessages).share;
  const [platform, setPlatform] = useState<SharePlatform>("wechat");
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const texts = useMemo(() => shareTexts(job, employer, `${origin}/jobs/${job.id}`), [job, employer, origin]);
  const name = t.platforms[platform];
  const id = useId();

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h2 className="text-body font-semibold">{t.heading}</h2>
      <TabList
        label={t.tabsLabel}
        idBase={id}
        tabs={SHARE_PLATFORMS.map((p) => ({ key: p.key, label: t.platforms[p.key] }))}
        value={platform}
        onChange={setPlatform}
        className="flex gap-2"
        tabClassName={(selected) => `${pillTab(selected)} flex-1 px-2`}
      />
      <TabPanel idBase={id} value={platform} className="space-y-2">
        <p className="text-meta text-muted">
          {t.hints[platform]}
          {job.contactPublic ? t.contactPublicNote : t.contactPrivateNote}
        </p>
        <textarea
          readOnly
          lang="zh-CN"
          value={texts[platform]}
          rows={platform === "wechat" ? 7 : 12}
          aria-label={t.textLabel(name)}
          className="w-full rounded-control border border-border bg-background p-3 text-body leading-relaxed"
        />
        <CopyButton text={texts[platform]} label={t.copyLabel(name)} size="md" className="w-full rounded-control" />
      </TabPanel>
    </section>
  );
}
