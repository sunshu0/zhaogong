"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  closeMyResumeShare,
  myResumeShareLink,
  shareMyResume,
  type ResumeShareView,
} from "@/app/[lang]/profile/resume/actions";
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
import { busyProps } from "@/components/ui/busy";
import { Group, Section } from "@/components/ui/Section";
import type { VisaAccepted } from "@/lib/types";
import { inputClass } from "@/components/ui/input-class";
import { Select } from "@/components/ui/Select";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

const LONG_FIELDS: ResumeTextField[] = ["skills", "bio"];

/** The share copy as the server keeps it, to tell whether an open link still shows the page as it is now. */
const sharedForm = (doc: ResumeDoc) => JSON.stringify(parseResumeDoc(shareCopy(doc)));

/**
 * /profile/resume (中英文简历, #86): the sheet as it prints, what is missing in English, and the few things only the
 * resume needs. Everything is saved with the rest of the page (on the account since #104); 分享链接 keeps its own copy.
 */
export function ResumePage() {
  const lang = useLang();
  const t = useMessages(seekerProfileMessages).resume;
  const session = useSession();
  const { profile, update } = useProfile();
  const [saved, setSaved] = useState<boolean | null>(null);

  if (session?.activeRole === "employer") return <p className="py-8 text-body text-muted">{t.seekerOnly}</p>;

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
            {t.back}
          </Link>
          <h1 className="mt-1 text-title font-semibold">{t.title}</h1>
          <p className="mt-0.5 text-meta text-muted">{t.intro}</p>
        </div>
        <PrintButton />
      </header>

      {missing.length > 0 && (
        <p role="note" className="rounded-control bg-warn-soft px-3 py-2 text-body">
          {t.missingEnglish(missing.length, missing.map((field) => TEXT_LABELS[field][lang]).join(t.listJoin))}
          <a href="#resume-english" className="text-brand underline underline-offset-4">
            {t.fillEnglish}
          </a>
          {lang === "zh" ? "。" : "."}
        </p>
      )}

      <ResumeSheet doc={doc} />

      <Section look="app" id="resume-english" title={t.english} description={t.englishHint}>
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

      <Section look="app" id="resume-visa" title={t.visa} description={t.visaHint}>
        <Group>
          <VisaFields profile={profile} onChange={(workRights) => change({ workRights })} />
        </Group>
      </Section>

      <Section look="app" id="resume-contact" title={t.contact} description={t.contactHint}>
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
  const lang = useLang();
  const t = useMessages(seekerProfileMessages).resume;
  const label = t.englishField(TEXT_LABELS[field][lang]);
  const hint = !chinese ? (
    t.noChinese
  ) : regionsChosen ? (
    t.regionsHaveEnglish
  ) : (
    <>
      {t.chinese}
      <span lang={contentLang(chinese)}>{chinese}</span>
    </>
  );
  const id = `resume-en-${field}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-body font-medium">
        {label}
        {missing && <span className="text-meta font-normal text-warn">{t.toFill}</span>}
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
  const lang = useLang();
  const t = useMessages(seekerProfileMessages).resume;
  const rights = profile.workRights;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* The label looks like the other fields'; Select's own is only read out. */}
      <div className="text-body">
        <label htmlFor="resume-visa-held" className="mb-1 block font-medium">
          {t.visaHeld}
        </label>
        <Select
          id="resume-visa-held"
          label={t.visaHeld}
          hideLabel
          placeholder={t.visaNone}
          value={rights?.visa ?? ""}
          options={(Object.entries(HELD_VISA_LABELS) as [VisaAccepted, { zh: string; en: string }][]).map(
            ([visa, label]) => ({ value: visa, label: label[lang] }),
          )}
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
          <span className="mb-1 block font-medium">{t.weeklyHours}</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="80"
            value={rights.weeklyHours ?? ""}
            onChange={(event) =>
              onChange({ visa: rights.visa, weeklyHours: event.target.value ? Number(event.target.value) : undefined })
            }
            placeholder={t.weeklyHoursPlaceholder}
            className={inputClass()}
          />
        </label>
      )}
    </div>
  );
}

function ContactChoice({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (value: NonNullable<Profile["resumeContact"]>) => void;
}) {
  const t = useMessages(seekerProfileMessages).resume;
  const choice = profile.resumeContact ?? NO_CONTACT;
  return (
    <fieldset>
      <legend className="sr-only">{t.contact}</legend>
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
              {t[key]}
              <span className="text-meta text-muted">{value || t.notFilled}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-1 text-meta text-muted">{t.noEmailInLink}</p>
    </fieldset>
  );
}

/** 生成分享链接, which gets the focus back when the link is closed (#202). */
const MAKE = "resume-share-make";

/**
 * 分享链接: off until the person opens it. The link shows a copy of the page as it was when shared, so a change
 * since then is pointed out with 更新分享内容. Closing it makes the link show nothing.
 */
function ShareSection({ doc }: { doc: ResumeDoc }) {
  const t = useMessages(seekerProfileMessages).resume;
  const [share, setShare] = useState<ResumeShareView | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [acting, setActing] = useState<"share" | "close" | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const focusAfter = useRef<"link" | "make" | null>(null);
  // The buttons change with the link's state: the focus goes to the link once shared or updated, and to 生成分享链接
  // once closed (#202).
  useEffect(() => {
    const target =
      focusAfter.current === "link"
        ? link.current
        : focusAfter.current === "make"
          ? document.getElementById(MAKE)
          : null;
    focusAfter.current = null;
    target?.focus();
  }, [share]);

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

  const shareNow = () => {
    setActing("share");
    startTransition(async () => {
      const result = await shareMyResume(shareCopy(doc));
      setError(result.ok ? "" : result.error);
      if (result.ok) {
        focusAfter.current = "link";
        setShare(result.share);
      }
    });
  };
  const close = () => {
    setActing("close");
    startTransition(async () => {
      await closeMyResumeShare();
      focusAfter.current = "make";
      setShare(null);
    });
  };

  const url = share ? `${origin}${share.path}` : "";
  const outdated = share && JSON.stringify(share.resume) !== sharedForm(doc);

  return (
    <Section look="app" id="resume-share" title={t.share} description={t.shareHint}>
      <Group className="space-y-3">
        {share === undefined ? (
          <p role="status" className="text-meta text-muted">
            {t.shareLoading}
          </p>
        ) : share ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-body">
              <span className="font-medium">{t.shareOn}</span>
              <a
                ref={link}
                href={share.path}
                target="_blank"
                rel="noreferrer"
                className="break-all font-latin text-brand underline underline-offset-4"
              >
                {url}
              </a>
              <CopyButton text={url} label={t.copyLink} />
            </p>
            {outdated && <p className="text-meta text-warn">{t.shareStale}</p>}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={shareNow}
                disabled={!outdated && !pending}
                loading={pending && acting === "share"}
                {...busyProps(pending && acting !== "share")}
              >
                {t.shareUpdate}
              </Button>
              <Button
                variant="link"
                onClick={close}
                loading={pending && acting === "close"}
                {...busyProps(pending && acting !== "close")}
              >
                {t.shareOff}
              </Button>
            </div>
          </>
        ) : (
          <Button id={MAKE} variant="secondary" onClick={shareNow} loading={pending}>
            {t.shareMake}
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
