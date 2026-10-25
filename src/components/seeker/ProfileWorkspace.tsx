"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ExternalLink, FileText } from "lucide-react";
import { profileChecklist, profileProgress } from "@/components/account/profile-checklist";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useProfile, useProfileSave } from "@/components/seeker/hub-client";
import { readOnlyNote } from "@/components/employer/employer-page";
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
import { useLang, useMessages } from "@/i18n/client";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";
import { contentLang } from "@/i18n/lang";
import { candidateMatchingMessages } from "@/i18n/messages/candidate-matching";

/**
 * /profile (我的主页 / 企业主页): what the other side sees at the top, how complete it is, then the required
 * fields; optional ones are folded away. Every change is saved as you type (C5), in this browser and on the server:
 * a job seeker's to the account (#104), a 企业主页 to the business (ADR 0022). There is no save button, and a failed
 * save says so instead of pretending. Only an admin changes a 企业主页; a member sees its fields read-only.
 */
export function ProfileWorkspace() {
  const lang = useLang();
  const t = useMessages(seekerProfileMessages);
  const w = t.workspace;
  const { profile, update: updateProfile } = useProfile();
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  const verification = useEmployerProfile(isEmployer ? session.email : undefined).profile?.verification;
  const { admins, refused } = useProfileSave();
  const readOnly = isEmployer && admins !== undefined;
  const [localSave, setLocalSave] = useState<boolean | null>(null);

  const update: UpdateProfileField = (field, value) => {
    const saved = updateProfile({ [field]: value }) === true;
    setLocalSave(saved);
    return saved || undefined;
  };

  const progress = profileProgress(profileChecklist(profile, isEmployer, verification, lang));
  const keyItems = profileChecklist(profile, isEmployer, verification, lang).filter((item) => item.key);
  const optionalMissing = progress.missing.filter((item) => !item.key).length;

  return (
    <div className="space-y-section">
      <header>
        <h1 className="text-title font-semibold">{isEmployer ? w.employerTitle : w.seekerTitle}</h1>
        <p className="mt-0.5 text-meta text-muted">{isEmployer ? w.employerSaves : w.seekerSaves}</p>
        {readOnly && (
          <p className="mt-3 rounded-control bg-brand-soft px-3 py-2 text-body">{readOnlyNote(admins, lang)}</p>
        )}
        {/* #195: the page is public, signed out too; the server refused what cannot be shown. */}
        {isEmployer && refused && refused.length > 0 && (
          <div role="alert" className="mt-3 space-y-1 rounded-control bg-danger-soft px-3 py-2 text-body text-danger">
            <p className="font-medium">{w.notSaved}</p>
            <ul className="list-disc space-y-1 pl-5">
              {refused.map((finding) => (
                <li key={finding.message_zh}>{finding.message_zh}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <ProfileChoice />

      <Section
        look="sheet"
        id="profile-preview"
        title={w.preview}
        description={isEmployer ? w.employerPreviewHint : w.seekerPreviewHint}
        action={
          isEmployer && session?.employerId ? (
            <Link
              href={`/employers/${session.employerId}`}
              className="inline-flex min-h-11 items-center gap-1 text-body text-brand underline-offset-4 hover:underline"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              {w.viewPublic}
            </Link>
          ) : !isEmployer ? (
            <Link
              href="/profile/resume"
              className="inline-flex min-h-11 items-center gap-1 text-body text-brand underline-offset-4 hover:underline"
            >
              <FileText aria-hidden="true" className="size-4" />
              {w.makeResume}
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

      <Section look="sheet" id="profile-progress" title={w.progress(progress.done, progress.total)}>
        <Group>
          <div
            role="progressbar"
            aria-label={w.progressLabel}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-2 overflow-hidden rounded-full bg-neutral-soft"
          >
            <div className="h-full bg-brand" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="mt-3 text-meta text-muted">{isEmployer ? w.seekersWant : w.employersWant}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body">
            {keyItems.map((item) => (
              <li key={item.id} className={`flex items-center gap-1 ${item.done ? "" : "text-warn"}`}>
                {item.done ? (
                  <Check aria-hidden="true" className="size-4 text-ok" />
                ) : (
                  <span aria-hidden="true">·</span>
                )}
                {item.label}
                <span className="sr-only">{item.done ? w.filled : w.toFill}</span>
              </li>
            ))}
          </ul>
        </Group>
      </Section>

      <Section look="sheet" id="profile-required" title={w.required} description={w.requiredHint}>
        <Group className="space-y-4">
          {isEmployer ? (
            <>
              {/* A member reads the business's page (ADR 0022): the fields stay, disabled. */}
              <fieldset disabled={readOnly} className="min-w-0 space-y-4">
                <legend className="sr-only">
                  {w.employerTitle}
                  {readOnly ? w.adminOnly : ""}
                </legend>
                <EmployerRequiredFields profile={profile} update={update} />
              </fieldset>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
                <span className="font-medium">{w.verification}</span>
                {verification && <VerificationBadge verification={verification} lang={lang} />}
                <Link href="/employer/verify" className="text-brand underline-offset-4 hover:underline">
                  {w.manageVerification}
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

      <Section look="sheet">
        <details className="group py-group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-subtitle font-semibold [&::-webkit-details-marker]:hidden">
            <span>
              {w.optional}
              <span className="ml-2 text-meta font-normal text-muted">
                {optionalMissing ? w.optionalMissing(optionalMissing) : w.allFilled}
              </span>
            </span>
            <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <fieldset disabled={readOnly} className="mt-3 min-w-0 space-y-4">
            {readOnly && (
              <legend className="sr-only">
                {w.employerTitle}
                {w.adminOnly}
              </legend>
            )}
            <div>
              <p className="mb-1 text-body font-medium">{w.avatar}</p>
              <ProfileAvatarEditor
                value={profile.avatar}
                fallback={profile.name.slice(0, 1) || w.me}
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
          </fieldset>
        </details>
      </Section>

      {!isEmployer && (
        <Section look="sheet" id="profile-recommend" title={w.recommend} description={w.recommendHint}>
          <Group>
            <DiscoverableToggle value={profile.resume} onChange={(resume) => update("resume", resume)} />
          </Group>
        </Section>
      )}

      <Section
        look="sheet"
        id="profile-private"
        title={w.private}
        description={`${w.privateHint}${isEmployer ? w.privateHintTeam : ""}`}
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
        className="sticky bottom-above-nav z-10 rounded-card bg-surface/90 px-4 py-2 shadow-pop backdrop-blur-md"
      />
    </div>
  );
}

/** The profile as 推荐人才 and the candidate page would show it. */
function asCandidate(profile: Profile): Candidate {
  return { ...profile, id: "preview", source: "local", resume: profile.resume ?? EMPTY_RESUME };
}

function SeekerPreview({ profile }: { profile: Profile }) {
  const missing = useMessages(candidateMatchingMessages).facts.missing;
  const w = useMessages(seekerProfileMessages).workspace;
  const lang = useLang();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <AvatarImage avatar={profile.avatar} fallback={profile.name || w.me} />
        <div className="min-w-0">
          <p lang={contentLang(profile.name)} className="truncate text-subtitle font-semibold">
            {profile.name || w.noName}
          </p>
          <p lang={contentLang(profile.headline)} className="truncate text-meta text-muted">
            {profile.headline || w.noHeadline}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
        {candidateFacts(asCandidate(profile), lang).map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-meta text-muted">{fact.label}</dt>
            <dd lang={contentLang(fact.value)} className={`break-words ${fact.value === missing ? "text-muted" : ""}`}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EmployerPreview({ profile, verification }: { profile: Profile; verification?: EmployerVerification }) {
  const w = useMessages(seekerProfileMessages).workspace;
  const lang = useLang();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <AvatarImage avatar={profile.avatar} fallback={profile.name || w.business} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
            <span lang={contentLang(profile.name)} className="break-words">
              {profile.name || w.noBusinessName}
            </span>
            {verification && <VerificationBadge verification={verification} lang={lang} />}
          </p>
          <p lang={contentLang(profile.headline)} className="truncate text-meta text-muted">
            {profile.headline || w.noBusinessHeadline}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
        <PreviewFact term={w.region} value={profile.location} empty={w.toBeFilled} />
        <PreviewFact term={w.contactName} value={profile.contactName} empty={w.toBeFilled} />
      </dl>
      <p className={`line-clamp-3 whitespace-pre-line text-body ${profile.bio ? "" : "text-muted"}`}>
        {profile.bio || w.noBusinessBio}
      </p>
    </div>
  );
}

function PreviewFact({ term, value, empty }: { term: string; value: string; empty: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-muted">{term}</dt>
      <dd lang={contentLang(value)} className={`break-words ${value.trim() ? "" : "text-muted"}`}>
        {value.trim() || empty}
      </dd>
    </div>
  );
}
