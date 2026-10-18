"use client";
// State and steps of /employer/post. Each handler is its own function over the state, so the page
// component only lays things out.
import {
  useEffect,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
  type TransitionStartFunction,
} from "react";
import { resumeChat, startChat, type ChatState } from "@/lib/ai-post";
import type { CountryCode, Job } from "@/lib/types";
import { parseDraft, publishJob } from "@/app/[lang]/employer/actions";
import { emptyForm, formFromDraft } from "@/components/employer/post-form";
import { useDraftForm, type DraftFormState } from "@/components/employer/use-draft-form";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { clearPost, loadPost, savePost, type SavedPost } from "@/components/employer/post-draft-store";

export type Step = "chat" | "paste" | "form" | "preview" | "done";
export type Mode = "chat" | "form";

export const PUBLISH_ERRORS = {
  signed_out: "登录已失效，请重新登录后再发布。",
  no_identity: "需要先开通雇主身份，请从页头的「发布招聘」重新进入。",
  banned: "这个雇主账号已被停用，不能发布职位。",
  not_ready: "服务器检查没有通过，请回到上一步修改。",
};

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface PostingState {
  country: CountryCode;
  mode: Mode;
  setMode: Setter<Mode>;
  step: Step;
  setStep: Setter<Step>;
  chat: ChatState;
  setChat: Setter<ChatState>;
  text: string;
  setText: Setter<string>;
  form: DraftFormState;
  notes: string[];
  setNotes: Setter<string[]>;
  previewAt: number;
  setPreviewAt: Setter<number>;
  published?: Job;
  setPublished: Setter<Job | undefined>;
  error?: string;
  setError: Setter<string | undefined>;
  pending: boolean;
  startTransition: TransitionStartFunction;
  /** The page opened on a draft left in this tab (#178). */
  restored: boolean;
  setRestored: Setter<boolean>;
}

/** Where a kept draft picks up: a preview goes back to its chat or its form, which a preview is made from. */
function resumeFrom(saved: SavedPost): { step: Step; chat: ChatState } {
  if (saved.step !== "preview") return { step: saved.step, chat: saved.chat };
  return saved.mode === "chat" ? { step: "chat", chat: resumeChat(saved.chat) } : { step: "form", chat: saved.chat };
}

function usePostingState(country: CountryCode, email: string): PostingState {
  // The page renders in the browser only (EmployerGate waits for the session), so this tab's storage is there.
  const [saved] = useState(() => loadPost(sessionStorage, email));
  const [resumed] = useState(() => (saved ? resumeFrom(saved) : undefined));
  const [restored, setRestored] = useState(!!saved);
  const [mode, setMode] = useState<Mode>(saved?.mode ?? "chat");
  const [step, setStep] = useState<Step>(resumed?.step ?? "chat");
  const [chat, setChat] = useState<ChatState>(() => resumed?.chat ?? startChat(country));
  const [text, setText] = useState(saved?.text ?? "");
  // The badge decides which visas the form offers; it comes from the server, not the session.
  const { profile } = useEmployerProfile(email);
  const form = useDraftForm(country, saved ? { form: saved.form, englishByHand: saved.englishByHand } : {}, profile);
  const [notes, setNotes] = useState<string[]>(saved?.notes ?? []);
  const [previewAt, setPreviewAt] = useState(0);
  const [published, setPublished] = useState<Job>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // Keep the draft in this tab as it changes; a published job (step "done") is no longer a draft.
  useEffect(() => {
    if (step === "done") return clearPost(sessionStorage);
    savePost(sessionStorage, {
      email,
      mode,
      step,
      chat,
      text,
      form: form.form,
      englishByHand: form.englishByHand,
      notes,
    });
  }, [email, mode, step, chat, text, form.form, form.englishByHand, notes]);

  return {
    country,
    mode,
    setMode,
    step,
    setStep,
    chat,
    setChat,
    text,
    setText,
    form,
    notes,
    setNotes,
    previewAt,
    setPreviewAt,
    published,
    setPublished,
    error,
    setError,
    pending,
    startTransition,
    restored,
    setRestored,
  };
}

/** The posting page's state and what its buttons do. */
export function usePosting(email: string, country: CountryCode) {
  const state = usePostingState(country, email);
  return {
    ...state,
    parse: () => parsePasted(state),
    previewFromChat: (next: ChatState) => previewFromChat(state, next),
    switchToForm: () => switchToForm(state),
    switchMode: (next: Mode) => switchMode(state, next),
    backFromPreview: () => backFromPreview(state),
    toPreview: () => toPreview(state),
    publish: () => publish(state),
    startEmptyForm: () => startEmptyForm(state),
    startOver: () => startOver(state),
  };
}

export type Posting = ReturnType<typeof usePosting>;

function parsePasted(state: PostingState) {
  state.setError(undefined);
  state.startTransition(async () => {
    const result = await parseDraft(state.text);
    state.form.reset(formFromDraft(result.draft));
    state.setNotes(result.notes_zh);
    state.setStep("form");
    window.scrollTo({ top: 0 });
  });
}

function previewFromChat(state: PostingState, next: ChatState) {
  state.form.reset(formFromDraft(next.draft));
  toPreview(state);
}

/** 直接填表: carries over what the chat has gathered, or starts on the paste step. */
function switchToForm(state: PostingState) {
  state.setMode("form");
  const chatHasStarted = state.chat.messages.length > 1;
  if (chatHasStarted) {
    state.form.reset(formFromDraft(state.chat.draft));
    state.setNotes([]);
    state.setStep("form");
  } else state.setStep("paste");
}

function switchMode(state: PostingState, next: Mode) {
  if (next === state.mode) return;
  if (next === "form") return switchToForm(state);
  state.setMode("chat");
  state.setStep("chat");
}

function backFromPreview(state: PostingState) {
  if (state.mode === "chat") {
    state.setChat(resumeChat(state.chat));
    state.setStep("chat");
  } else state.setStep("form");
}

function toPreview(state: PostingState) {
  state.setPreviewAt(Date.now());
  state.setStep("preview");
  window.scrollTo({ top: 0 });
}

function publish(state: PostingState) {
  state.setError(undefined);
  state.startTransition(async () => {
    const result = await publishJob(state.form.draft);
    if (result.ok) {
      state.setPublished(result.job);
      state.setStep("done");
    } else {
      state.setError(PUBLISH_ERRORS[result.reason]);
    }
    window.scrollTo({ top: 0 });
  });
}

/** 不用粘贴，直接填表: an empty form. */
function startEmptyForm(state: PostingState) {
  state.form.reset(emptyForm());
  state.setNotes([]);
  state.setStep("form");
}

/** 再发一条, and 清空重来 on a kept draft: back to a fresh chat (the empty draft is then not kept). */
function startOver(state: PostingState) {
  state.setRestored(false);
  state.setText("");
  state.form.reset(emptyForm());
  state.setChat(startChat(state.country));
  state.setPublished(undefined);
  state.setMode("chat");
  state.setStep("chat");
}
