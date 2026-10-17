"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  closeMyResumeShare,
  myResumeShareLink,
  shareMyResume,
  type ResumeShareView,
} from "@/app/profile/resume/actions";
import { CopyButton } from "@/components/seeker/CopyButton";
import { PrintButton } from "@/components/seeker/PrintButton";
import { useProfile } from "@/components/seeker/hub-client";
import { ProfileChoice, ProfileSaveNote } from "@/components/seeker/ProfileSaveNote";
import type { Profile } from "@/components/seeker/hub-state";
import {
  HELD_VISA_LABELS,
  missingEnglish,
  NO_CONTACT,
  parseResumeDoc,
  RESUME_TEXT_FIELDS,
  resumeDocFrom,
  shareCopy,
  TEXT_LABELS,
  type ResumeDoc,
  type ResumeTextField,
} from "@/components/seeker/resume-doc";
import { ResumePrintStyle, ResumeSheet } from "@/components/seeker/ResumeSheet";
import { useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { Group, Section } from "@/components/ui/Section";
import type { VisaAccepted } from "@/lib/types";
import { inputClass } from "@/components/ui/input-class";
import { Select } from "@/components/ui/Select";

const LONG_FIELDS: ResumeTextField[] = ["skills", "bio"];

/** The share copy as the server keeps it, to tell whether an open link still shows the page as it is now. */
const sharedForm = (doc: ResumeDoc) => JSON.stringify(parseResumeDoc(shareCopy(doc)));

/**
 * /profile/resume (中英文简历, #86): the sheet as it prints, what is missing in English, and the few things only the
 * resume needs. Everything is saved with the rest of the page (on the account since #104); 分享链接 keeps its own copy.
 */
export function ResumePage() {
  const session = useSession();
  const { profile, update } = useProfile();
  const [saved, setSaved] = useState<boolean | null>(null);

  if (session?.activeRole === "employer")
    return <p className="py-8 text-body text-muted">简历是求职者身份的功能。请在身份菜单里切换为求职者后再生成。</p>;

  const doc = resumeDocFrom(profile);
  const missing = missingEnglish(doc);
  const change = (patch: Partial<Profile>) => setSaved(update(patch) === true);

  return (
    <div className="space-y-section">
      <ResumePrintStyle />
      <ProfileChoice />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/profile" className="pressable inline-flex min-h-11 items-center text-meta text-brand">
            ← 我的主页
          </Link>
          <h1 className="mt-1 text-title font-semibold">中英文简历</h1>
          <p className="mt-0.5 text-meta text-muted">
            用主页资料生成。打印时选「存为 PDF」就能得到 PDF 文件，A4 一页。
          </p>
        </div>
        <PrintButton />
      </header>

      {missing.length > 0 && (
        <p role="note" className="rounded-control bg-warn-soft px-3 py-2 text-body">
          英文还缺 {missing.length} 项：{missing.map((field) => TEXT_LABELS[field].zh).join("、")}。缺的项只印中文，
          <a href="#resume-english" className="text-brand underline underline-offset-4">
            去补填英文
          </a>
          。
        </p>
      )}

      <ResumeSheet doc={doc} />

      <Section
        look="app"
        id="resume-english"
        title="英文资料"
        description="简历的英文部分只用你在这里写的英文，平台不翻译。中文在「我的主页」里改。"
      >
        <Group className="space-y-4">
          {RESUME_TEXT_FIELDS.map((field) => (
            <EnglishField
              key={field}
              field={field}
              chinese={doc.zh[field]}
              value={profile.english?.[field] ?? ""}
              missing={missing.includes(field)}
              regionsChosen={field === "location" && doc.facts.regionIds.length > 0}
              onChange={(value) => change({ english: { ...profile.english, [field]: value } })}
            />
          ))}
        </Group>
      </Section>

      <Section
        look="app"
        id="resume-visa"
        title="签证"
        description="只写事实：你持有的签证，以及签证上写的每周可工作时间。不填就不印。"
      >
        <Group>
          <VisaFields profile={profile} onChange={(workRights) => change({ workRights })} />
        </Group>
      </Section>

      <Section
        look="app"
        id="resume-contact"
        title="印上联系方式"
        description="勾选的会印在简历上。号码在主页的「私密交换资料」里填写。"
      >
        <Group>
          <ContactChoice profile={profile} onChange={(resumeContact) => change({ resumeContact })} />
        </Group>
      </Section>

      <ShareSection doc={doc} />

      <ProfileSaveNote localSave={saved} />
    </div>
  );
}

function EnglishField({
  field,
  chinese,
  value,
  missing,
  regionsChosen,
  onChange,
}: {
  field: ResumeTextField;
  chinese: string;
  value: string;
  missing: boolean;
  regionsChosen: boolean;
  onChange: (value: string) => void;
}) {
  const label = `${TEXT_LABELS[field].zh}（英文）`;
  const hint = !chinese
    ? "中文还没填，这一项不会印。"
    : regionsChosen
      ? "已选的可上班地区有英文名，可以不填。"
      : `中文：${chinese}`;
  const id = `resume-en-${field}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-body font-medium">
        {label}
        {missing && <span className="text-meta font-normal text-warn">待补填</span>}
      </label>
      {LONG_FIELDS.includes(field) ? (
        <textarea
          id={id}
          rows={field === "bio" ? 4 : 2}
          lang="en"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-hint`}
          className={`resize-y ${inputClass({ multiline: true })}`}
        />
      ) : (
        <input
          id={id}
          lang="en"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-hint`}
          className={inputClass()}
        />
      )}
      <p id={`${id}-hint`} className="mt-1 line-clamp-2 text-meta text-muted">
        {hint}
      </p>
    </div>
  );
}

function VisaFields({ profile, onChange }: { profile: Profile; onChange: (value: Profile["workRights"]) => void }) {
  const rights = profile.workRights;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* The label looks like the other fields'; Select's own is only read out. */}
      <div className="text-body">
        <label htmlFor="resume-visa-held" className="mb-1 block font-medium">
          持有的签证
        </label>
        <Select
          id="resume-visa-held"
          label="持有的签证"
          hideLabel
          placeholder="不填"
          value={rights?.visa ?? ""}
          options={(Object.entries(HELD_VISA_LABELS) as [VisaAccepted, { zh: string }][]).map(([visa, label]) => ({
            value: visa,
            label: label.zh,
          }))}
          onChange={(value) => {
            const visa = value as VisaAccepted | "";
            onChange(
              visa ? { visa, weeklyHours: visa === "citizen_resident" ? undefined : rights?.weeklyHours } : undefined,
            );
          }}
        />
      </div>
      {rights && rights.visa !== "citizen_resident" && (
        <label className="block text-body">
          <span className="mb-1 block font-medium">每周可工作（小时，选填）</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="80"
            value={rights.weeklyHours ?? ""}
            onChange={(event) =>
              onChange({ visa: rights.visa, weeklyHours: event.target.value ? Number(event.target.value) : undefined })
            }
            placeholder="按签证上写的填"
            className={inputClass()}
          />
        </label>
      )}
    </div>
  );
}

const CONTACT_LABELS = { phone: "电话", wechat: "微信", email: "邮箱" } as const;

function ContactChoice({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (value: NonNullable<Profile["resumeContact"]>) => void;
}) {
  const choice = profile.resumeContact ?? NO_CONTACT;
  return (
    <fieldset>
      <legend className="sr-only">印上联系方式</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(["phone", "wechat", "email"] as const).map((key) => {
          const value = profile.privateDetails?.[key]?.trim();
          return (
            <label key={key} className="flex min-h-11 items-center gap-2 text-body">
              <input
                type="checkbox"
                checked={choice[key] && Boolean(value)}
                disabled={!value}
                onChange={(event) => onChange({ ...choice, [key]: event.target.checked })}
                className="size-5 accent-brand"
              />
              {CONTACT_LABELS[key]}
              <span className="text-meta text-muted">{value || "未填写"}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-1 text-meta text-muted">分享链接里不显示邮箱。</p>
    </fieldset>
  );
}

/**
 * 分享链接: off until the person opens it. The link shows a copy of the page as it was when shared, so a change
 * since then is pointed out with 更新分享内容. Closing it makes the link show nothing.
 */
function ShareSection({ doc }: { doc: ResumeDoc }) {
  const [share, setShare] = useState<ResumeShareView | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    myResumeShareLink().then((link) => {
      if (!live) return;
      setOrigin(window.location.origin);
      setShare(link);
    });
    return () => {
      live = false;
    };
  }, []);

  const shareNow = () =>
    startTransition(async () => {
      const result = await shareMyResume(shareCopy(doc));
      setError(result.ok ? "" : result.error);
      if (result.ok) setShare(result.share);
    });
  const close = () =>
    startTransition(async () => {
      await closeMyResumeShare();
      setShare(null);
    });

  const url = share ? `${origin}${share.path}` : "";
  const outdated = share && JSON.stringify(share.resume) !== sharedForm(doc);

  return (
    <Section
      look="app"
      id="resume-share"
      title="分享链接"
      description="默认不公开。打开后，拿到链接的人不用登录就能看这份简历（不含邮箱），比如不在平台上的雇主。可以随时关闭。"
    >
      <Group className="space-y-3">
        {share === undefined ? (
          <p role="status" className="text-meta text-muted">
            正在读取分享状态…
          </p>
        ) : share ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-body">
              <span className="font-medium">已打开：</span>
              <a
                href={share.path}
                target="_blank"
                rel="noreferrer"
                className="break-all font-latin text-brand underline underline-offset-4"
              >
                {url}
              </a>
              <CopyButton text={url} label="复制链接" />
            </p>
            {outdated && (
              <p className="text-meta text-warn">
                资料改过了，链接里还是上次分享时的内容。点「更新分享内容」让链接也变。
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={shareNow} disabled={pending || !outdated}>
                更新分享内容
              </Button>
              <Button variant="link" onClick={close} disabled={pending}>
                关闭链接
              </Button>
            </div>
          </>
        ) : (
          <Button variant="secondary" onClick={shareNow} disabled={pending}>
            生成分享链接
          </Button>
        )}
        {error && (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
      </Group>
    </Section>
  );
}
