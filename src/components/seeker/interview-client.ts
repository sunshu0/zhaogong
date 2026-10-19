"use client";

import { myInterviewTodos } from "@/app/[lang]/me/interview-actions";
import type { InterviewTodo } from "@/app/[lang]/me/interview-notifications";
import type { DemoSession } from "@/components/seeker/session";
import { identityScope } from "@/components/seeker/identity-scope";
import { interviewIcs, type InterviewView } from "@/components/seeker/interviews";
import { useServerLoad } from "@/components/ui/use-server-load";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";

/**
 * The identity's interview to-dos (#103) from the server; `todos` is undefined until they arrive, so 总览 waits
 * rather than shows a list that is about to change. Kept per identity: switching identity loads the other side's.
 * No answer is `failed` (with `reload` for 重试) and no to-dos, so the rest of 总览 still shows and says the
 * interviews are missing rather than that there are none (#252).
 */
export function useInterviewTodos(session: DemoSession | null): {
  todos: InterviewTodo[] | undefined;
  failed: boolean;
  reload: () => void;
} {
  const { value, failed, reload } = useServerLoad(session ? identityScope(session) : undefined, myInterviewTodos);
  if (!session) return { todos: [], failed: false, reload };
  return { todos: failed ? [] : value, failed, reload };
}

/** Saves the confirmed interview as a calendar file (.ics); nothing is sent to any calendar service. */
export function downloadInterviewIcs(
  interview: InterviewView,
  id: string,
  title: string,
  filename = "面试.ics",
  lang: Lang = DEFAULT_LANG,
) {
  if (!interview.chosenSlot) return;
  const file = interviewIcs({
    uid: id,
    start: interview.chosenSlot,
    title,
    mode: interview.mode,
    place: interview.place,
    note: interview.note,
    stamp: new Date().toISOString(),
    lang,
  });
  const url = URL.createObjectURL(new Blob([file], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
