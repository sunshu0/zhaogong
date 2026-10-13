"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import { useProfile } from "@/components/seeker/hub-client";
import type { Profile } from "@/components/seeker/hub-state";
import { ProfileAvatarEditor } from "@/components/seeker/ProfileAvatar";
import { PrivateDetailsFields, ProfileBasics, type UpdateProfileField } from "@/components/seeker/ProfileFields";
import { ResumeEditor } from "@/components/seeker/ResumeEditor";
import { useSession } from "@/components/seeker/session-client";
import { workspaceTitle } from "@/components/seeker/workspace";

export function ProfileWorkspace() {
  const { profile, update: updateProfile } = useProfile();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const [saved, setSaved] = useState(false);

  const update: UpdateProfileField = (field, value) => {
    setSaved(false);
    return updateProfile({ [field]: value });
  };

  function save(event: FormEvent) {
    event.preventDefault();
    updateProfile(profile);
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-medium text-brand">{workspaceTitle(isEmployer)}</p>
        <h1 className="mt-1 text-2xl font-semibold">{isEmployer ? "企业主页" : "我的求职主页"}</h1>
      </header>
      {isEmployer && <EmployerPageLinks employerId={session.employerId} />}
      <form onSubmit={save} className="space-y-4">
        <section className="flex flex-wrap items-center gap-3 border-b border-border py-4">
          <ProfileAvatarEditor
            value={profile.avatar}
            fallback={profile.name.slice(0, 1) || "我"}
            onChange={(avatar) => update("avatar", avatar)}
          />
          <div>
            <p className="font-medium">{profile.name || (isEmployer ? "企业名称" : "你的名字")}</p>
            <p className="text-xs text-muted">{visibilityNote(isEmployer, profile.resume?.discoverable)}</p>
          </div>
        </section>
        <ProfileBasics profile={profile} isEmployer={isEmployer} update={update} />
        <ProfilePreview profile={profile} isEmployer={isEmployer} />
        {!isEmployer && <ResumeEditor value={profile.resume} onChange={(resume) => update("resume", resume)} />}
        <PrivateDetailsFields
          details={profile.privateDetails}
          onChange={(details) => update("privateDetails", details)}
        />
        <div className="flex items-center justify-end gap-3">
          <span role="status" className="text-sm text-ok">
            {saved ? "已保存到本机" : ""}
          </span>
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            保存资料
          </button>
        </div>
      </form>
    </div>
  );
}

/** Who can see this profile, under the name. */
function visibilityNote(isEmployer: boolean, discoverable: boolean | undefined): string {
  if (isEmployer) return "企业主页 · 招聘联系人";
  if (discoverable) return "求职主页 · 可向雇主推荐";
  return "个人主页 · 仅对你选择的联系人可见";
}

function EmployerPageLinks({ employerId }: { employerId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
      <Link
        href={`/employers/${employerId}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand underline"
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        查看公开主页
      </Link>
      <Link href="/employer/verify" className="inline-flex min-h-11 items-center text-sm text-brand underline">
        管理公司资质
      </Link>
      <p className="text-xs text-muted">企业资料对求职者公开；本机演示资料。</p>
    </div>
  );
}

function ProfilePreview({ profile, isEmployer }: { profile: Profile; isEmployer: boolean }) {
  return (
    <section className="border-t border-border pt-4">
      <h2 className="font-medium">资料预览</h2>
      <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-4">
        <p className="font-semibold">{profile.headline || "简介待填写"}</p>
        {isEmployer && <p className="text-sm">招聘联系人：{profile.contactName || "待填写"}</p>}
        <p className="text-sm text-muted">
          {profile.location || "地区待填写"} · {profile.languages || "语言待填写"}
        </p>
        <p className="text-sm leading-relaxed">{profile.bio || (isEmployer ? "企业介绍待填写" : "个人介绍待填写")}</p>
        <p className="text-xs text-muted">
          {profile.availability || (isEmployer ? "联系时间待填写" : "可工作时间待填写")}
        </p>
      </div>
    </section>
  );
}
