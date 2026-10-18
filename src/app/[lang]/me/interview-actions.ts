"use server";

// 约面试, the job seeker's side (#103): answer the employer's invitation — confirm one of the times, decline, or
// say in their own words when suits — and the workspace's interview to-dos for either side. The account is the one
// in this browser's session cookie.
import { getCurrentSession } from "@/lib/auth";
import { myApplication } from "@/db/job-applications";
import { answerInterview, interviewsFor, interviewView } from "@/db/interviews";
import { parseResponse, type InterviewView } from "@/components/seeker/interviews";
import { interviewTodos, type InterviewTodo } from "@/app/[lang]/me/interview-notifications";

export type AnswerResult = { ok: true; interview: InterviewView } | { ok: false; error: string };

/** Answers the invitation on the account's application for the job. */
export async function answerMyInterview(jobId: string, response: unknown): Promise<AnswerResult> {
  const session = await getCurrentSession();
  if (!session || session.activeRole !== "seeker" || typeof jobId !== "string")
    return { ok: false, error: "请用求职者身份登录后再回复" };
  const application = await myApplication(session.email, jobId);
  const row = application && (await interviewsFor([application.id])).get(application.id);
  if (!application || !row) return { ok: false, error: "找不到这个面试邀约" };
  const now = new Date();
  const parsed = parseResponse(response, interviewView(row), now.getTime());
  if (!parsed.ok) return parsed;
  const answered = await answerInterview(application.id, parsed.response, now);
  return answered
    ? { ok: true, interview: interviewView(answered) }
    : { ok: false, error: "这个邀约已经变了，请刷新后再看" };
}

/** The signed-in identity's interview to-dos; none when signed out. */
export async function myInterviewTodos(): Promise<InterviewTodo[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  return interviewTodos({ email: session.email, isEmployer: session.activeRole === "employer" }, Date.now());
}
