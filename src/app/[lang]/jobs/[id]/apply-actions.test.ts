import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { notificationHref } from "@/components/seeker/hub-state";
import { cancelInterview, inviteToInterview } from "@/db/interviews";
import { addModerationLog, banEmployer, ensureAccount, openEmployerIdentity, updateJob } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { applyForJob, myAppliedJobIds, myApplicationViews, myJobApplication, withdrawMyApplication } =
  await import("@/app/[lang]/jobs/[id]/apply-actions");
const { decideMyApplicant, getMyApplicationCounts, getMyJobApplicants, markMyApplicantsSeen } =
  await import("@/app/[lang]/employer/applicant-actions");
const { myAlertNotifications } = await import("@/app/[lang]/me/alerts/actions");
const { markMyNotificationsRead } = await import("@/app/[lang]/messages/actions");
const { saveMyProfile } = await import("@/app/[lang]/profile/actions");
const { closeMyJob, getMyJobDays } = await import("@/app/[lang]/employer/actions");

const PAGE = {
  name: "林晓",
  headline: "两年奶茶店经验",
  location: "市中心",
  languages: "普通话、英语",
  availability: "周末",
  bio: "做事细心。",
  privateDetails: { phone: "09 055 0101", wechat: "linxiao", email: "lin.private@example.com" },
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
  it("records apply_submit with the job once the application is stored, and nothing when it is refused (#319)", async () => {
    const { database } = await import("@/db/ready");
    const t = await import("@/db/schema");
    const db = await database();
    await db.delete(t.events);
    await signedIn("apply.funnel@example.com");
    expect(await applyForJob("j5", "", PAGE)).toMatchObject({ ok: true });
    expect(await applyForJob("j5", "", PAGE)).toMatchObject({ ok: false, reason: "already" });
    const rows = await db.select().from(t.events);
    expect(rows.map((r) => [r.name, r.path, r.jobId, r.role])).toEqual([
      ["apply_submit", "/jobs/[id]", "j5", "seeker"],
    ]);
    expect(JSON.stringify(rows)).not.toContain("apply.funnel");
  });

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

describe("the page an application carries (#104)", () => {
  it("is the account's own page once it saved one, not what the browser sends", async () => {
    await signedIn("apply.account@example.com");
    await saveMyProfile({ name: "账号里的王芳", availability: "只有周末" });
    expect(await applyForJob("j4", "", PAGE)).toMatchObject({ ok: true });

    await openEmployerIdentity("apply.e2@example.com", "e2");
    await signedIn("apply.e2@example.com", "employer");
    const applicant = (await getMyJobApplicants("j4"))!.applicants.find((a) => a.profile.name === "账号里的王芳");
    expect(applicant?.profile).toMatchObject({ name: "账号里的王芳", availability: "只有周末" });
  });
});

describe("已录用和职位结束 (#105)", () => {
  /** The job seeker's notifications about how their applications ended. */
  async function outcomes() {
    return (await myAlertNotifications())!.items.filter((n) => /^(hired|job-ended):/.test(n.id));
  }

  it("tells the one hired, then everyone else the same words once the job ends, 不合适 included", async () => {
    for (const who of ["hired.one", "fit.two", "unfit.three"]) {
      await signedIn(`${who}@example.com`);
      expect(await applyForJob("j8", "", PAGE)).toMatchObject({ ok: true });
    }
    await openEmployerIdentity("boss.e5@example.com", "e5");
    await signedIn("boss.e5@example.com", "employer");
    const ids = (await getMyJobApplicants("j8"))!.applicants.map((a) => a.id);
    expect(await decideMyApplicant(ids[0], "hired")).toBe(true);
    expect(await decideMyApplicant(ids[1], "fit")).toBe(true);
    expect(await decideMyApplicant(ids[2], "unfit")).toBe(true);
    // 约面试 counts the invitations that were not called off.
    const invite = { slots: ["2099-01-05T01:00:00.000Z"], callFirst: false, mode: null, place: "", note: "" };
    await inviteToInterview("e5", ids[1], invite);
    await inviteToInterview("e5", ids[2], invite);
    await cancelInterview("e5", ids[2]);
    expect((await getMyJobDays("j8"))!.funnel).toEqual({ applied: 3, interviewed: 1, hired: 1 });

    // Hired: told at once, and the application is over.
    await signedIn("hired.one@example.com");
    expect((await myApplicationViews())![0]).toMatchObject({ jobId: "j8", status: "已录用", stage: "ended" });
    const [hired] = await outcomes();
    expect(hired).toMatchObject({ type: "申请", title: expect.stringMatching(/录用了你$/), unread: true });
    expect(hired.detail).toContain("「装修木工」");
    expect(notificationHref(hired, { email: "hired.one@example.com", signedInAt: "", activeRole: "seeker" })).toBe(
      "/me/saved",
    );
    expect((await markMyNotificationsRead([hired.id]))!.ids).toContain(hired.id);

    // The others: nothing yet while the job is open.
    await signedIn("fit.two@example.com");
    expect((await myApplicationViews())![0]).toMatchObject({ status: "雇主觉得合适", stage: "open" });
    expect(await outcomes()).toEqual([]);

    await signedIn("boss.e5@example.com", "employer");
    expect(await closeMyJob("j8", { hired: true, count: 1 })).toMatchObject({ ok: true });

    const seen: string[] = [];
    for (const who of ["fit.two", "unfit.three"]) {
      await signedIn(`${who}@example.com`);
      expect((await myApplicationViews())![0]).toMatchObject({ status: "职位已结束", stage: "ended" });
      expect((await myJobApplication("j8"))!.status).toBe("职位已结束");
      const notes = await outcomes();
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({ title: "「装修木工」已经招满", time: "今天", unread: true });
      seen.push(`${notes[0].title}|${notes[0].detail}`);
    }
    // 不合适 reads exactly like 合适.
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).not.toMatch(/不合适|拒/);
  });

  it("says 已结束 for a job taken down, from when it was taken down", async () => {
    await signedIn("taken.down@example.com");
    expect(await applyForJob("j9", "", PAGE)).toMatchObject({ ok: true });
    expect(await outcomes()).toEqual([]);
    await updateJob("j9", { status: "removed" });
    await addModerationLog({ action: "take_down", jobId: "j9", moderator: "mod@example.com" });
    const [ended] = await outcomes();
    expect(ended).toMatchObject({ title: "「油漆工」已结束", time: "今天" });
    expect((await myApplicationViews())!.find((a) => a.jobId === "j9")).toMatchObject({
      stage: "ended",
      status: "职位已结束",
      gone: true,
    });
  });
});
