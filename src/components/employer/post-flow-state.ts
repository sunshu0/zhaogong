"use client";
// State and steps of /employer/post. Each handler is its own function over the state, so the page
// component only lays things out.
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
  type TransitionStartFunction,
} from "react";
import { resumeChat, startChat, type ChatState } from "@/lib/ai-post";
import { isParseNote, type ParseNote } from "@/lib/ai-post/parse";
import type { CountryCode, Job } from "@/lib/types";
import { parseDraft, publishJob } from "@/app/[lang]/employer/actions";
import { emptyForm, formFromDraft } from "@/components/employer/post-form";
import { useDraftForm, type DraftFormState } from "@/components/employer/use-draft-form";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { clearPost, loadPost, savePost, type SavedPost } from "@/components/employer/post-draft-store";
import { useLang } from "@/i18n/client";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { uiMessages } from "@/i18n/messages/ui";

export type Step = "chat" | "paste" | "form" | "preview" | "done";
export type Mode = "chat" | "form";

/** Why the server would not publish. */
export type PublishErrorReason = keyof (typeof employerPostMessages)["zh"]["publishErrors"];

export function publishError(reason: PublishErrorReason, lang: Lang = DEFAULT_LANG): string {
  return pick(employerPostMessages, lang).publishErrors[reason];
}

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface PostingState {
  country: CountryCode;
  /** The language the page renders in, for the messages the handlers below put in `error`. */
  lang: Lang;
  mode: Mode;
  setMode: Setter<Mode>;
  step: Step;
  setStep: Setter<Step>;
  chat: ChatState;
  setChat: Setter<ChatState>;
  text: string;
  setText: Setter<string>;
  form: DraftFormState;
  /** The parser's notes about the pasted text, by id; DraftEditor looks their words up (Round 20). */
  notes: ParseNote[];
  setNotes: Setter<ParseNote[]>;
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
  const lang = useLang();
  // The page renders in the browser only (EmployerGate waits for the session), so this tab's storage is there.
  const [saved] = useState(() => loadPost(sessionStorage, email));
  const [resumed] = useState(() => (saved ? resumeFrom(saved) : undefined));
  const [restored, setRestored] = useState(!!saved);
  const [mode, setMode] = useState<Mode>(saved?.mode ?? "chat");
  const [step, goToStep] = useState<Step>(resumed?.step ?? "chat");
  const [chat, setChat] = useState<ChatState>(() => resumed?.chat ?? startChat(country));
  const [text, setText] = useState(saved?.text ?? "");
  // The badge decides which visas the form offers; it comes from the server, not the session.
  const { profile } = useEmployerProfile(email);
  const form = useDraftForm(country, saved ? { form: saved.form, englishByHand: saved.englishByHand } : {}, profile);
  // A draft kept by an older version holds the notes' Chinese; anything that is not a note id is dropped.
  const [notes, setNotes] = useState<ParseNote[]>(() => (saved?.notes ?? []).filter(isParseNote));
  const [previewAt, setPreviewAt] = useState(0);
  const [published, setPublished] = useState<Job>();
  const [error, setError] = useState<string>();
  // #297: an error belongs to the step it happened on; going to another step (返回修改, 换方式, 清空重来, 再发一条)
  // takes it away, in this one place.
  const setStep = useCallback<Setter<Step>>((next) => {
    setError(undefined);
    goToStep(next);
  }, []);
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
    lang,
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
    // #247: with no answer the pasted message stays on its step, and the step says so.
    const result = await parseDraft(state.text).catch(() => null);
    if (!result) return state.setError(pick(uiMessages, state.lang).load.noAnswer);
    state.form.reset(formFromDraft(result.draft));
    state.setNotes(result.notes);
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
    // #247: with no answer the preview stays, and says so.
    const result = await publishJob(state.form.draft).catch(() => null);
    if (result?.ok) {
      state.setPublished(result.job);
      state.setStep("done");
    } else {
      state.setError(result ? publishError(result.reason, state.lang) : pick(uiMessages, state.lang).load.noAnswer);
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
