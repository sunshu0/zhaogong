"use client";
import Link from "next/link";
import { useState, useTransition, type RefObject } from "react";
import { resumeChat, SAMPLE_POST, startChat, type ChatState } from "@/lib/ai-post";
import type { CountryCode, Employer, Job } from "@/lib/types";
import { parseDraft, publishJob } from "@/app/employer/actions";
import { ChatPost } from "@/components/employer/ChatPost";
import { DraftEditor } from "@/components/employer/DraftEditor";
import { completeJob, emptyForm, formFromDraft } from "@/components/employer/post-form";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { ShareTexts } from "@/components/employer/ShareTexts";
import { CLEAR_OF_STICKY_BARS, holdReason, keepFocusClear, useDraftForm } from "@/components/employer/use-draft-form";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { JobDetail } from "@/components/seeker/JobDetail";
import { contactKinds } from "@/components/seeker/job-facts";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";

type Step = "chat" | "paste" | "form" | "preview" | "done";
type Mode = "chat" | "form";

const PUBLISH_ERRORS = {
  no_identity: "需要先开通雇主身份，请从页头的「发布招聘」重新进入。",
  banned: "这个雇主账号已被停用，不能发布职位。",
  not_ready: "服务器检查没有通过，请回到上一步修改。",
};

const STEPS: Record<Mode, { key: Exclude<Step, "done">; label: string }[]> = {
  chat: [
    { key: "chat", label: "和助手对话" },
    { key: "preview", label: "预览发布" },
  ],
  form: [
    { key: "paste", label: "粘贴" },
    { key: "form", label: "核对" },
    { key: "preview", label: "预览发布" },
  ],
};

const SAMPLE = SAMPLE_POST;

/** /employer/post: the employer identity first, then the chat or the form. */
export function PostFlow({ country }: { country: CountryCode }) {
  return <EmployerGate next="/employer/post">{(me) => <Posting me={me} country={country} />}</EmployerGate>;
}

function Posting({ me, country }: { me: EmployerIdentity; country: CountryCode }) {
  const [mode, setMode] = useState<Mode>("chat");
  const [step, setStep] = useState<Step>("chat");
  const [chat, setChat] = useState<ChatState>(() => startChat(country));
  const [text, setText] = useState("");
  const state = useDraftForm(country);
  const { draft, findings, missing, decision, ready } = state;
  const [notes, setNotes] = useState<string[]>([]);
  const [previewAt, setPreviewAt] = useState(0);
  const [published, setPublished] = useState<Job>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const heading = useFocusOnChange<HTMLHeadingElement>(step);

  // The badge and a ban come from the server; the session only has the name.
  const { profile } = useEmployerProfile(me.email);
  const employer = profile ?? undefined;
  const shopName = profile?.name ?? me.employerName;
  const banned = !!profile?.bannedAt;

  function parse() {
    setError(undefined);
    startTransition(async () => {
      const result = await parseDraft(text);
      state.reset(formFromDraft(result.draft));
      setNotes(result.notes_zh);
      setStep("form");
      window.scrollTo({ top: 0 });
    });
  }

  function previewFromChat(next: ChatState) {
    state.reset(formFromDraft(next.draft));
    toPreview();
  }

  function switchToForm() {
    setMode("form");
    if (chat.messages.length > 1) {
      state.reset(formFromDraft(chat.draft));
      setNotes([]);
      setStep("form");
    } else setStep("paste");
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "form") return switchToForm();
    setMode("chat");
    setStep("chat");
  }

  function backFromPreview() {
    if (mode === "chat") {
      setChat(resumeChat(chat));
      setStep("chat");
    } else setStep("form");
  }

  function toPreview() {
    setPreviewAt(Date.now());
    setStep("preview");
    window.scrollTo({ top: 0 });
  }

  function publish() {

    setError(undefined);
    startTransition(async () => {
      const result = await publishJob(draft, me.email);
      if (result.ok) {
        setPublished(result.job);
        setStep("done");
      } else {
        setError(PUBLISH_ERRORS[result.reason]);
      }
      window.scrollTo({ top: 0 });
    });
  }

  if (step === "done" && published) {
    return (
      <Published
        job={published}
        employer={employer}
        headingRef={heading}
        onAgain={() => {
          setText("");
          state.reset(emptyForm());
          setChat(startChat(country));
          setPublished(undefined);
          setMode("chat");
          setStep("chat");
        }}
      />
    );
  }

  const preview = step === "preview" ? completeJob(draft, me.employerId, previewAt, decision.status) : undefined;

  return (
    <div className="space-y-4 pb-24">
      <ol aria-label="发布步骤" className="flex gap-2 text-xs">
        {STEPS[mode].map((s, i) => (
          <li key={s.key} aria-current={s.key === step ? "step" : undefined} className={`flex-1 rounded-full px-2 py-1 text-center ${s.key === step ? "bg-brand text-white" : "bg-surface text-muted"}`}>
            {i + 1} {s.label}
          </li>
        ))}
      </ol>

      {(step === "chat" || step === "paste") && (
        <div role="group" aria-label="发布方式" className="flex gap-2">
          {(
            [
              ["chat", "对话发布"],
              ["form", "直接填表"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => switchMode(key)}
              className={`h-9 rounded-full px-4 text-sm ${mode === key ? "bg-brand text-white" : "border border-border bg-surface text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {step === "chat" && (
        <ChatPost chat={chat} setChat={setChat} country={country} headingRef={heading} onPreview={previewFromChat} onUseForm={switchToForm} />
      )}

      {step === "paste" && (
        <section onFocus={keepFocusClear} className={`space-y-3 ${CLEAR_OF_STICKY_BARS}`}>
          <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
            一分钟发布招聘
          </h1>
          <label htmlFor="post-text" className="block text-sm text-muted">
            把微信群里的招聘消息粘贴进来，或者直接写：招什么人、在哪个区、时薪多少、怎么联系你。
          </label>
          <textarea
            id="post-text"
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={SAMPLE}
            className="w-full rounded-xl border border-border bg-surface p-3 leading-relaxed placeholder:text-muted/60"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!text.trim() || pending}
              onClick={parse}
              className="h-12 flex-1 rounded-xl bg-brand px-6 font-semibold text-white disabled:opacity-40"
            >
              {pending ? "整理中…" : "整理成职位"}
            </button>
            <button type="button" onClick={() => setText(SAMPLE)} className="text-sm text-brand underline">
              用示例试试
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              state.reset(emptyForm());
              setNotes([]);
              setStep("form");
            }}
            className="text-sm text-muted underline"
          >
            不用粘贴，直接填表
          </button>
        </section>
      )}

      {step === "form" && (
        <h1 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
          核对职位信息
        </h1>
      )}
      {step === "form" && (
        <div onFocus={keepFocusClear} className={`${WIDE_ON_DESKTOP} ${CLEAR_OF_STICKY_BARS}`}>
          <DraftEditor state={state} country={country} notes={notes} />
        </div>
      )}

      {step === "preview" && preview && (
        <section onFocus={keepFocusClear} className={`space-y-4 ${CLEAR_OF_STICKY_BARS}`}>
          <h1 ref={heading} tabIndex={-1} className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-normal text-brand outline-none">
            预览：这是求职者看到的样子。确认无误就可以发布了。
          </h1>
          {decision.status === "pending_review" && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">这个职位会先经过人工审核，通过后才公开。</p>
          )}
          <JobDetail job={{ ...preview, id: "preview" }} employer={employer} now={previewAt}>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="font-medium">联系方式</h2>
              <p className="mt-1 text-sm text-muted">登录后可以查看雇主的{contactKinds({ ...preview, id: "preview" }).join("、")}。</p>
            </section>
          </JobDetail>
          {banned && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">这个雇主账号已被停用，职位已全部下架，不能再发布。</p>}
        </section>
      )}

      {(step === "form" || step === "preview") && (
        <div className={`sticky bottom-0 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur ${step === "form" ? WIDE_ON_DESKTOP : ""}`}>
          {step === "form" ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep("paste")} className="text-sm text-muted underline">
                上一步
              </button>
              <p className="flex-1 text-xs text-muted">
                {ready ? (decision.status === "pending_review" ? "可以发布，需人工审核" : "可以发布") : holdReason(findings.length, missing.length)}
              </p>
              <button type="button" disabled={!ready} onClick={toPreview} className="h-11 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-40">
                预览
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" onClick={backFromPreview} className="text-sm text-muted underline">
                返回修改
              </button>
              <p className="flex-1 text-xs text-muted">{`以「${shopName}」发布`}</p>
              <button
                type="button"
                disabled={banned || pending}
                onClick={publish}
                className="h-11 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-40"
              >
                {pending ? "发布中…" : decision.status === "pending_review" ? "提交审核" : "发布"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Published({
  job,
  employer,
  headingRef,
  onAgain,
}: {
  job: Job;
  employer?: Employer;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAgain: () => void;
}) {
  const live = job.status === "active";
  return (
    <section className="space-y-4">
      <div className={`rounded-xl px-4 py-5 ${live ? "bg-ok-soft" : "bg-warn-soft"}`}>
        <h1 ref={headingRef} tabIndex={-1} className={`text-xl font-semibold outline-none ${live ? "text-ok" : "text-warn"}`}>{live ? "已发布" : "已提交审核"}</h1>
        <p className="mt-1 text-sm">
          {job.titleZh} · {live ? "求职者现在就能看到。" : "审核通过后公开，可以在「管理职位」里看到进度。"}
        </p>
        {live && (
          <Link href={`/jobs/${job.id}`} className="mt-3 inline-block text-sm text-brand underline">
            看看职位页面 →
          </Link>
        )}
      </div>
      {live ? (
        <ShareTexts job={job} employer={employer} />
      ) : (
        <p className="text-sm text-muted">审核通过后，可以在「管理职位」里复制发到微信群、小红书和 Skykiwi 的文案。</p>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onAgain} className="h-11 flex-1 rounded-xl border border-brand font-medium text-brand">
          再发一条
        </button>
        <Link href="/employer/jobs" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand font-medium text-white">
          管理职位
        </Link>
      </div>
    </section>
  );
}
