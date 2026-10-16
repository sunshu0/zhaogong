"use client";

import { useEffect, useState } from "react";
import { myInterviewTodos } from "@/app/me/interview-actions";
import type { InterviewTodo } from "@/app/me/interview-notifications";
import type { DemoSession } from "@/components/seeker/session";
import { identityScope } from "@/components/seeker/identity-scope";
import { interviewIcs, type InterviewView } from "@/components/seeker/interviews";

/**
 * The identity's interview to-dos (#103) from the server; undefined until they arrive, so 总览 waits rather than
 * shows a list that is about to change. Kept per identity: switching identity loads the other side's.
 */
export function useInterviewTodos(session: DemoSession | null): InterviewTodo[] | undefined {
  const scope = session ? identityScope(session) : "";
  const [loaded, setLoaded] = useState<{ scope: string; todos: InterviewTodo[] }>();
  useEffect(() => {
    if (!scope) return;
    let live = true;
    myInterviewTodos()
      .then((todos) => live && setLoaded({ scope, todos }))
      .catch(() => live && setLoaded({ scope, todos: [] }));
    return () => {
      live = false;
    };
  }, [scope]);
  if (!session) return [];
  return loaded?.scope === scope ? loaded.todos : undefined;
}

/** Saves the confirmed interview as a calendar file (.ics); nothing is sent to any calendar service. */
export function downloadInterviewIcs(interview: InterviewView, id: string, title: string) {
  if (!interview.chosenSlot) return;
  const file = interviewIcs({
    uid: id,
    start: interview.chosenSlot,
    title,
    mode: interview.mode,
    place: interview.place,
    note: interview.note,
    stamp: new Date().toISOString(),
  });
  const url = URL.createObjectURL(new Blob([file], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "面试.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
