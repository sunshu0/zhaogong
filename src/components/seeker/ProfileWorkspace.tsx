"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ExternalLink, FileText } from "lucide-react";
import { profileChecklist, profileProgress } from "@/components/account/profile-checklist";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useProfile } from "@/components/seeker/hub-client";
import { ProfileChoice, ProfileSaveNote } from "@/components/seeker/ProfileSaveNote";
import type { Profile } from "@/components/seeker/hub-state";
import { AvatarImage, ProfileAvatarEditor } from "@/components/seeker/ProfileAvatar";
import {
  EmployerOptionalFields,
  EmployerRequiredFields,
  PrivateDetailsFields,
  SeekerOptionalFields,
  SeekerRequiredFields,
  type UpdateProfileField,
} from "@/components/seeker/ProfileFields";
import {
  DiscoverableToggle,
  ResumeKeyFields,
  ResumeMoreFields,
  ResumeRoleField,
} from "@/components/seeker/ResumeEditor";
import { useSession } from "@/components/seeker/session-client";
import { Group, Section } from "@/components/ui/Section";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { candidateFacts, EMPTY_RESUME, type Candidate } from "@/lib/candidate-matching";
import type { EmployerVerification } from "@/lib/types";

/**
 * /profile (我的主页 / 企业主页): what the other side sees at the top, how complete it is, then the required
 * fields; optional ones are folded away. Every change is saved as you type (C5), in this browser and, for a job
 * seeker, to the account (#104): there is no save button, and a failed save says so instead of pretending.
 */
export function ProfileWorkspace() {
  const { profile, update: updateProfile } = useProfile();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const verification = useEmployerProfile(isEmployer ? session.email : undefined).profile?.verification;
  const [localSave, setLocalSave] = useState<boolean | null>(null);

  const update: UpdateProfileField = (field, value) => {
    const saved = updateProfile({ [field]: value }) === true;
    setLocalSave(saved);
    return saved || undefined;
  };

  const progress = profileProgress(profileChecklist(profile, isEmployer, verification));
  const keyItems = profileChecklist(profile, isEmployer, verification).filter((item) => item.key);
  const optionalMissing = progress.missing.filter((item) => !item.key).length;

  return (
    <div className="space-y-section">
      <header>
        <h1 className="text-title font-semibold">{isEmployer ? "企业主页" : "我的求职主页"}</h1>
        <p className="mt-0.5 text-meta text-muted">
          {isEmployer ? "改动会自动保存在这台设备上。" : "改动会自动保存到你的账号，换一台设备登录也能看到。"}
        </p>
      </header>

      <ProfileChoice />

      <Section
        id="profile-preview"
        title="别人看到的样子"
        description={isEmployer ? "求职者在职位和企业主页上看到这些" : "雇主在推荐人才和聊天里看到这些"}
        action={
          isEmployer && session?.employerId ? (
            <Link
              href={`/employers/${session.employerId}`}
              className="inline-flex min-h-11 items-center gap-1 text-body text-brand underline-offset-4 hover:underline"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              查看公开主页
            </Link>
          ) : !isEmployer ? (
            <Link
              href="/profile/resume"
              className="inline-flex min-h-11 items-center gap-1 text-body text-brand underline-offset-4 hover:underline"
            >
              <FileText aria-hidden="true" className="size-4" />
              生成简历
            </Link>
          ) : undefined
        }
      >
        <Group>
          {isEmployer ? (
            <EmployerPreview profile={profile} verification={verification} />
          ) : (
            <SeekerPreview profile={profile} />
          )}
        </Group>
      </Section>

      <Section id="profile-progress" title={`资料完成度 ${progress.done}/${progress.total}`}>
        <Group>
          <div
            role="progressbar"
            aria-label="资料完成度"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-2 overflow-hidden rounded-full bg-neutral-soft"
          >
            <div className="h-full bg-brand" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="mt-3 text-meta text-muted">{isEmployer ? "求职者最看重：" : "雇主最看重："}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body">
            {keyItems.map((item) => (
              <li key={item.id} className={`flex items-center gap-1 ${item.done ? "" : "text-warn"}`}>
                {item.done ? (
                  <Check aria-hidden="true" className="size-4 text-ok" />
                ) : (
                  <span aria-hidden="true">·</span>
                )}
                {item.label}
                <span className="sr-only">{item.done ? "（已填）" : "（待填）"}</span>
              </li>
            ))}
          </ul>
        </Group>
      </Section>

      <Section id="profile-required" title="必填" description="对方最先看的几项">
        <Group className="space-y-4">
          {isEmployer ? (
            <>
              <EmployerRequiredFields profile={profile} update={update} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
                <span className="font-medium">企业验证</span>
                {verification && <VerificationBadge verification={verification} />}
                <Link href="/employer/verify" className="text-brand underline-offset-4 hover:underline">
                  管理公司资质
                </Link>
              </div>
            </>
          ) : (
            <>
              <SeekerRequiredFields profile={profile} update={update} />
              <ResumeKeyFields value={profile.resume} onChange={(resume) => update("resume", resume)} />
              <ResumeRoleField value={profile.resume} onChange={(resume) => update("resume", resume)} />
            </>
          )}
        </Group>
      </Section>

      <Section>
        <details className="group py-group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-subtitle font-semibold [&::-webkit-details-marker]:hidden">
            <span>
              选填资料
              <span className="ml-2 text-meta font-normal text-muted">
                {optionalMissing ? `${optionalMissing} 项未填` : "已全部填写"}
              </span>
            </span>
            <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="mt-3 space-y-4">
            <div>
              <p className="mb-1 text-body font-medium">头像</p>
              <ProfileAvatarEditor
                value={profile.avatar}
                fallback={profile.name.slice(0, 1) || "我"}
                onChange={(avatar) => update("avatar", avatar)}
              />
            </div>
            {isEmployer ? (
              <EmployerOptionalFields profile={profile} update={update} />
            ) : (
              <>
                <SeekerOptionalFields profile={profile} update={update} />
                <ResumeMoreFields value={profile.resume} onChange={(resume) => update("resume", resume)} />
              </>
            )}
          </div>
        </details>
      </Section>

      {!isEmployer && (
        <Section id="profile-recommend" title="推荐给雇主" description="打开后，雇主可以在「推荐人才」里看到上面的资料">
          <Group>
            <DiscoverableToggle value={profile.resume} onChange={(resume) => update("resume", resume)} />
          </Group>
        </Section>
      )}

      <Section
        id="profile-private"
        title="私密交换资料"
        description="只在聊天里交换时给对方：你发起交换时对方马上能看到；对方发起时，你同意后才给。不显示在公开主页。"
      >
        <Group>
          <PrivateDetailsFields
            details={profile.privateDetails}
            onChange={(details) => update("privateDetails", details)}
          />
        </Group>
      </Section>

      {/* Stays in view at the bottom while the form scrolls, above the phone's bottom bar. */}
      <ProfileSaveNote
        localSave={localSave}
        className="sticky bottom-above-nav z-10 -mx-4 border-t border-border bg-surface px-4 py-2 sm:mx-0 sm:rounded-md sm:border"
      />
    </div>
  );
}

/** The profile as 推荐人才 and the candidate page would show it. */
function asCandidate(profile: Profile): Candidate {
  return { ...profile, id: "preview", source: "local", resume: profile.resume ?? EMPTY_RESUME };
}

function SeekerPreview({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <AvatarImage avatar={profile.avatar} fallback={profile.name || "我"} />
        <div className="min-w-0">
          <p className="truncate text-subtitle font-semibold">{profile.name || "称呼待填写"}</p>
          <p className="truncate text-meta text-muted">{profile.headline || "一句话介绍待填写"}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
        {candidateFacts(asCandidate(profile)).map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-meta text-muted">{fact.label}</dt>
            <dd className={`break-words ${fact.value === "待补充" ? "text-muted" : ""}`}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EmployerPreview({ profile, verification }: { profile: Profile; verification?: EmployerVerification }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <AvatarImage avatar={profile.avatar} fallback={profile.name || "企"} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
            <span className="break-words">{profile.name || "企业名称待填写"}</span>
            {verification && <VerificationBadge verification={verification} />}
          </p>
          <p className="truncate text-meta text-muted">{profile.headline || "招聘简介待填写"}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
        <PreviewFact term="地区" value={profile.location} />
        <PreviewFact term="招聘联系人" value={profile.contactName} />
      </dl>
      <p className={`line-clamp-3 whitespace-pre-line text-body ${profile.bio ? "" : "text-muted"}`}>
        {profile.bio || "企业介绍待填写"}
      </p>
    </div>
  );
}

function PreviewFact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-muted">{term}</dt>
      <dd className={`break-words ${value.trim() ? "" : "text-muted"}`}>{value.trim() || "待填写"}</dd>
    </div>
  );
}
