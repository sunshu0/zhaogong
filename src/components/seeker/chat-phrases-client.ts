"use client";

// The account's 常用语 and 开场白 in the browser (#372, #373, ADR 0035): loaded once per account from the server
// and shared by the chat (ChatPhrases.tsx) and 立即沟通 (StartEmployerChat.tsx); a save puts what the server kept.
import { useEffect, useSyncExternalStore } from "react";
import { myChatPhrases, saveMyChatPhrases, type PhrasesSave } from "@/app/[lang]/messages/phrases-actions";
import { NO_PHRASES, type ChatPhrases, type OpenerChoice, type PhraseRole } from "@/lib/chat-phrases";
import { normalizeEmail } from "@/components/seeker/session";

type Kept = { email: string; phrases: ChatPhrases };

let kept: Kept | null = null;
let loading: { email: string; promise: Promise<ChatPhrases> } | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function keep(next: Kept) {
  kept = next;
  for (const listener of listeners) listener();
}

/**
 * What the account keeps, loaded once. When the server does not answer, the defaults for this time only (nothing is
 * kept, so the next look asks again).
 */
export function loadChatPhrases(email: string): Promise<ChatPhrases> {
  const who = normalizeEmail(email);
  if (kept?.email === who) return Promise.resolve(kept.phrases);
  if (loading?.email === who) return loading.promise;
  const promise = myChatPhrases()
    .then(
      (answer) => {
        if (!answer || normalizeEmail(answer.email) !== who) return NO_PHRASES;
        keep({ email: who, phrases: answer.phrases });
        return answer.phrases;
      },
      () => NO_PHRASES,
    )
    .finally(() => {
      if (loading?.promise === promise) loading = null;
    });
  loading = { email: who, promise };
  return promise;
}

/** The signed-in account's 常用语 and 开场白; undefined while they load or when the server did not answer. */
export function useChatPhrases(email: string | undefined): ChatPhrases | undefined {
  const who = email ? normalizeEmail(email) : undefined;
  const current = useSyncExternalStore(
    subscribe,
    () => kept,
    () => null,
  );
  useEffect(() => {
    if (who) void loadChatPhrases(who);
  }, [who]);
  return who && current?.email === who ? current.phrases : undefined;
}

/** Saves through the server; what it kept replaces what the browser had. */
export async function saveChatPhrases(save: {
  role: PhraseRole;
  phrases?: string[] | null;
  opener?: OpenerChoice | null;
}): Promise<PhrasesSave | null> {
  const answer = await saveMyChatPhrases(save);
  if (answer?.ok) keep({ email: normalizeEmail(answer.email), phrases: answer.phrases });
  return answer;
}
