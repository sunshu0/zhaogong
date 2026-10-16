import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { notificationHref } from "@/components/seeker/hub-state";
import { banEmployer, ensureAccount, openEmployerIdentity, updateJob } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { applyForJob, myAppliedJobIds, myApplicationViews, myJobApplication, withdrawMyApplication } =
  await import("@/app/jobs/[id]/apply-actions");
const { decideMyApplicant, getMyApplicationCounts, getMyJobApplicants, markMyApplicantsSeen } =
  await import("@/app/employer/applicant-actions");
const { myAlertNotifications } = await import("@/app/me/alerts/actions");
const { markMyNotificationsRead } = await import("@/app/messages/actions");

const PAGE = {
  name: "林晓",
  headline: "两年奶茶店经验",
  location: "市中心",
  languages: "普通话、英语",
  availability: "周末",
  bio: "做事细心。",
  privateDetails: { phone: "021 555 0101", wechat: "linxiao", email: "lin.private@example.com" },
  resume: { discoverable: false, skills: "收银", employmentTypes: ["part_time"], regionIds: ["akl-cbd"] },
};

async function signedIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, role, jar);
}

beforeEach(() => {
  setAuthStoreForTests();
  setChatServerStoreForTests(memoryChatStore());
  cookies.clear();
});

describe("applying for a job (#84)", () => {
  it("records one application per job with the note and the page, which the job seeker can withdraw", async () => {
    await signedIn("apply.one@example.com");
    expect(await myJobApplication("j3")).toBeNull();
    const result = await applyForJob("j3", "  周末可以上班  ", PAGE);
    expect(result).toMatchObject({
      ok: true,
      application: { jobId: "j3", note: "周末可以上班", status: "已申请，等雇主查看" },
    });
    expect(await applyForJob("j3", "", PAGE)).toMatchObject({ ok: false, reason: "already" });
    expect(await myAppliedJobIds()).toEqual(["j3"]);
    expect((await myApplicationViews())![0]).toMatchObject({ jobId: "j3", titleZh: "点心师傅", gone: false });

    expect(await withdrawMyApplication("j3")).toBe(true);
    expect(await myJobApplication("j3")).toBeNull();
    expect(await applyForJob("j3", "", PAGE)).toMatchObject({ ok: true }); // can apply again after withdrawing
  });

  it("refuses signed out, as an employer, closed jobs, banned businesses, the own business, no name, a long note", async () => {
    expect(await applyForJob("j1", "", PAGE)).toMatchObject({ ok: false, reason: "signed_out" });
    expect(await myAppliedJobIds()).toBeNull();

    await openEmployerIdentity("apply.boss@example.com", "e1");
    await signedIn("apply.boss@example.com", "employer");
    expect(await applyForJob("j1", "", PAGE)).toMatchObject({ ok: false, reason: "employer_identity" });
    await signedIn("apply.boss@example.com", "seeker");
    expect(await applyForJob("j1", "", PAGE)).toMatchObject({
      ok: false,
      reason: "own_job",
      error: "不能申请自己企业的职位",
    });

    await signedIn("apply.two@example.com");
    expect(await applyForJob("j2", "", { ...PAGE, name: " " })).toMatchObject({ ok: false, reason: "no_profile" });
    expect(await applyForJob("j2", "好".repeat(201), PAGE)).toMatchObject({ ok: false, reason: "note_too_long" });
    await updateJob("j2", { expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(await applyForJob("j2", "", PAGE)).toMatchObject({ ok: false, reason: "closed" });
    await updateJob("j6", { status: "removed" });
    expect(await applyForJob("j6", "", PAGE)).toMatchObject({ ok: false, reason: "closed" });
    await banEmployer("e7");
    expect(await applyForJob("j11", "", PAGE)).toMatchObject({ ok: false, reason: "banned" });
    expect(await applyForJob("no-such-job", "", PAGE)).toMatchObject({ ok: false, reason: "closed" });
  });
});

describe("the employer's applicant list (#84)", () => {
  it("counts applications, lists them without contact details, marks them seen when shown, records 合适 / 不合适", async () => {
    await signedIn("apply.three@example.com");
    await applyForJob("j4", "会做点心", PAGE);

    // Another business sees nothing of it.
    await openEmployerIdentity("apply.other@example.com", "e3");
    await signedIn("apply.other@example.com", "employer");
    expect(await getMyJobApplicants("j4")).toBeNull();
    expect((await getMyApplicationCounts()).j4).toBeUndefined();

    await openEmployerIdentity("apply.e2@example.com", "e2");
    await signedIn("apply.e2@example.com", "employer");
    expect((await getMyApplicationCounts()).j4).toEqual({ total: 1, unseen: 1 });
    // 通知: one per application, read once the list was opened; the employer can mark it read too.
    const notice = (await myAlertNotifications())!.items.find((n) => n.type === "申请")!;
    expect(notice).toMatchObject({ title: "林晓申请了楼面服务员", detail: "附言：会做点心", unread: true });
    expect(notificationHref(notice, { email: "apply.e2@example.com", signedInAt: "", activeRole: "employer" })).toBe(
      "/employer/jobs/j4/applicants",
    );
    expect((await markMyNotificationsRead([notice.id]))!.ids).toContain(notice.id);
    const first = await getMyJobApplicants("j4");
    expect(first!.applicants).toHaveLength(1);
    const [applicant] = first!.applicants;
    expect(applicant).toMatchObject({ note: "会做点心", isNew: true, decision: null, profile: { name: "林晓" } });
    expect(applicant.facts.map((f) => f.label)).toEqual(["可上班时间", "地区", "期望时薪", "语言", "经验"]);
    expect(JSON.stringify(first)).not.toMatch(/apply\.three|021 555|linxiao|lin\.private/);
    expect((await getMyApplicationCounts()).j4).toEqual({ total: 1, unseen: 1 }); // reading changes nothing
    await markMyApplicantsSeen("j3"); // not theirs: nothing happens
    await markMyApplicantsSeen("j4");
    expect((await getMyApplicationCounts()).j4).toEqual({ total: 1, unseen: 0 });
    expect((await getMyJobApplicants("j4"))!.applicants[0].isNew).toBe(false);

    // The job seeker sees that the employer looked; 不合适 is never shown in those words.
    expect(await decideMyApplicant(applicant.id, "unfit")).toBe(true);
    expect(await decideMyApplicant(applicant.id, "maybe")).toBe(false);
    await signedIn("apply.three@example.com");
    expect((await myJobApplication("j4"))!.status).toBe("雇主已看过");

    await signedIn("apply.e2@example.com", "employer");
    expect(await decideMyApplicant(applicant.id, "fit")).toBe(true);
    await signedIn("apply.three@example.com");
    expect((await myJobApplication("j4"))!.status).toBe("雇主觉得合适");

    // Not theirs: refused.
    await signedIn("apply.other@example.com", "employer");
    expect(await decideMyApplicant(applicant.id, "unfit")).toBe(false);
  });
});
