import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, SESSION_COOKIE, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { startChat } from "@/lib/ai-post";
import { recordChatStart, recordJobView } from "@/db/job-stats";
import {
  banEmployer,
  ensureAccount,
  getJob,
  getPlatformStats,
  listJobs,
  openEmployerIdentity,
  recordContactView,
} from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const {
  chatTurn,
  closeMyJob,
  confirmHires,
  editMyJob,
  getMyJobDays,
  getMyJobNumbers,
  getMyEmployer,
  getMyJob,
  getMyJobs,
  lookupBusiness,
  parseDraft,
  publishJob,
  refreshMyJob,
  verifyBusiness,
} = await import("@/app/employer/actions");

/** The email of each demo business's owner. The Server Functions take no email: the session says who acts. */
const E: Record<string, string> = {};
beforeAll(async () => {
  for (const id of ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"]) {
    const email = `owner.${id}@example.com`;
    const opened = await openEmployerIdentity(email, id);
    if (!opened.ok) throw new Error(`${id}: ${opened.reason}`);
    E[id] = email;
  }
});

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

/** Runs `call` from a browser signed in as `email` (a fresh session cookie). */
async function as<T>(email: string, call: () => Promise<T>): Promise<T> {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "employer", jar);
  return call();
}

const MESSAGE = `Mt Eden 川菜馆招前厅服务员，时薪 $25-27，每周 15-25 小时，包工作餐，学签可做。微信 demo_chuanwei`;

describe("publishJob", () => {
  it("publishes a clean draft as active, visible to job seekers", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const result = await as(E.e1, () => publishJob(draft));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job).toMatchObject({ employerId: "e1", status: "active", titleZh: "前厅服务员" });
    expect((await listJobs({ country: "NZ" })).map((j) => j.id)).toContain(result.job.id);
    expect((await as(E.e1, () => getMyJobs()))[0].id).toBe(result.job.id);
  });

  it("sends a high-risk draft to review instead of the list", async () => {
    const { draft } = await parseDraft(`${MESSAGE}，KTV 包间`);
    const result = await as(E.e1, () => publishJob(draft));
    expect(result.ok && result.job.status).toBe("pending_review");
  });

  it("re-checks on the server and refuses what the browser should have held back", async () => {
    const { draft } = await parseDraft(MESSAGE.replace("$25-27", "$20"));
    const result = await as(E.e1, () => publishJob({ ...draft, descriptionZh: "入职交押金。" }));
    expect(result).toMatchObject({ ok: false, reason: "not_ready" });
    expect(!result.ok && result.findings.map((f) => f.rule)).toEqual(["min_wage", "fee"]);
  });

  it("lets only an accredited employer list AEWV holders", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const withAewv = { ...draft, visaAccepted: ["student", "aewv"] };
    const refused = await as(E.e1, () => publishJob(withAewv)); // e1 is a verified business, not accredited
    expect(refused).toMatchObject({ ok: false, reason: "not_ready" });
    expect(!refused.ok && refused.findings.map((f) => f.rule)).toEqual(["aewv_unaccredited"]);
    expect(await as(E.e2, () => publishJob(withAewv))).toMatchObject({ ok: true }); // e2 is accredited
  });

  it("checks AEWV in the chat for the signed-in business only", async () => {
    const said = (await as(E.e1, () => chatTurn(startChat("NZ"), `${MESSAGE}，雇主担保工签可`))).messages.at(-1)!.text;
    expect(said).toContain("持 AEWV 工签者");
    cookies.clear(); // signed out again
    const anonymous = await chatTurn(startChat("NZ"), `${MESSAGE}，雇主担保工签可`);
    expect(anonymous.asking).not.toBe("fix");
  });

  it("refuses an incomplete draft and an unknown employer", async () => {
    expect(await as(E.e1, () => publishJob({ titleZh: "洗碗工" }))).toMatchObject({ ok: false, reason: "not_ready" });
    const { draft } = await parseDraft(MESSAGE);
    expect(await as("nobody@example.com", () => publishJob(draft))).toMatchObject({ ok: false, reason: "no_identity" });
  });

  it("ignores fields the browser should not set", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const result = await as(E.e1, () => publishJob({ ...draft, status: "active", employerId: E.e2, id: "j1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job.employerId).toBe("e1");
    expect(result.job.id).not.toBe("j1");
    expect((await getJob("j1"))?.titleZh).toBe("前厅服务员"); // the demo job is untouched
  });
});

describe("managing published jobs", () => {
  it("only lets the owner see or change a job", async () => {
    expect(await as(E.e2, () => getMyJob("j1"))).toBeNull();
    expect((await as(E.e1, () => getMyJob("j1")))?.id).toBe("j1");
    expect(await as(E.e2, () => closeMyJob("j1"))).toMatchObject({ ok: false, error_zh: "找不到这个职位。" });
  });

  it("closes a job, takes it off the list, and refreshing reopens it for 30 days", async () => {
    const closed = await as(E.e1, () => closeMyJob("j2"));
    expect(closed.ok && closed.job.status).toBe("expired");
    expect((await listJobs({ country: "NZ" })).map((j) => j.id)).not.toContain("j2");

    const reopened = await as(E.e1, () => refreshMyJob("j2"));
    expect(reopened.ok && reopened.job.status).toBe("active");
    expect(reopened.ok && Date.parse(reopened.job.expiresAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect(await as(E.e1, () => refreshMyJob("j2"))).toMatchObject({ ok: false, error_zh: "不能刷新：今天已刷新过" });
  });

  it("saves an edit after the same checks, and sends risky new text back to review", async () => {
    const job = (await as(E.e2, () => getMyJob("j3")))!;
    const blocked = await as(E.e2, () => editMyJob("j3", { ...job, descriptionZh: "包签，月入过万。" }));
    expect(blocked).toMatchObject({ ok: false });
    expect(!blocked.ok && blocked.findings?.map((f) => f.rule)).toEqual(["visa_selling"]);

    const edited = await as(E.e2, () =>
      editMyJob("j3", {
        ...job,
        titleZh: "点心主厨",
        shiftsZh: undefined,
        descriptionZh: "早茶点心，附近有 KTV。",
      }),
    );
    expect(edited.ok && edited.job).toMatchObject({
      id: "j3",
      titleZh: "点心主厨",
      status: "pending_review",
      postedAt: job.postedAt,
    });
    expect(edited.ok && edited.job.shiftsZh).toBeUndefined();
  });

  it("gives each job's views, chats started and contact reveals without saying who (#55)", async () => {
    await recordContactView("j4", "a@example.com");
    await recordContactView("j4", "b@example.com");
    await recordChatStart("j4", "a@example.com");
    await recordJobView("j4", "some-browser");
    const counts = await as(E.e2, () => getMyJobNumbers());
    expect(counts.j4).toEqual({ views: 1, chats: 1, contactViews: 2 });
    expect(JSON.stringify(counts)).not.toContain("@");

    const days = await as(E.e2, () => getMyJobDays("j4"));
    expect(days?.job.id).toBe("j4");
    expect(days?.days).toHaveLength(14);
    expect(days?.days.at(-1)).toMatchObject({ views: 1, chats: 1, contactViews: 2 });
    expect(JSON.stringify(days?.days)).not.toContain("@");
  });

  it("stops a banned employer from posting or editing", async () => {
    await banEmployer("e5");
    const { draft } = await parseDraft(MESSAGE);
    expect(await as(E.e5, () => publishJob(draft))).toMatchObject({ ok: false, reason: "banned" });
    expect(await as(E.e5, () => refreshMyJob("j8"))).toMatchObject({
      ok: false,
      error_zh: "账号已被停用，不能再修改职位。",
    });
  });
});

describe("business verification", () => {
  it("looks up the demo register by name or NZBN", async () => {
    expect((await lookupBusiness("悦美")).results.map((e) => e.nzbn)).toEqual(["9429000000004"]);
    expect((await lookupBusiness("123")).error_zh).toContain("13 位");
  });

  it("verifies an unverified shop with its register entry", async () => {
    const result = await as(E.e4, () => verifyBusiness("9429 0000 0000 4"));
    expect(result.ok && result.employer).toMatchObject({
      verification: "business_verified",
      legalName: "Demo Yuemei Hair Studio Limited",
    });
    expect(await as(E.e4, () => getMyEmployer())).toMatchObject({
      verification: "business_verified",
      businessNumber: "9429000000004",
    });
  });

  it("refuses a struck-off company, an unknown number and another shop's NZBN", async () => {
    expect(await as(E.e6, () => verifyBusiness("9429000000099"))).toMatchObject({
      ok: false,
      error_zh: expect.stringContaining("已注销"),
    });
    expect(await as(E.e6, () => verifyBusiness("9429000000123"))).toMatchObject({ ok: false });
    expect(await as(E.e6, () => verifyBusiness("9429000000001"))).toMatchObject({
      ok: false,
      error_zh: expect.stringContaining("其他店铺"),
    });
    expect((await as(E.e6, () => getMyEmployer()))?.verification).toBe("unverified");
  });

  it("keeps an accredited employer's badge", async () => {
    const result = await as(E.e2, () => verifyBusiness("9429000000002"));
    expect(result.ok && result.employer.verification).toBe("accredited_employer");
  });
});

describe("hires confirmed when a job ends", () => {
  it("saves the count with the close, and the platform total adds it up", async () => {
    const before = (await getPlatformStats("NZ")).hiresConfirmed;
    const closed = await as(E.e8, () => closeMyJob("j13", { hired: true, count: 2 }));
    expect(closed.ok && closed.job).toMatchObject({ status: "expired", hiresConfirmed: 2 });
    expect(closed.ok && closed.job.hiresConfirmedAt).toBeTruthy();
    expect((await getPlatformStats("NZ")).hiresConfirmed).toBe(before + 2);
  });

  it("ends a job without an answer, and records 没有 / 不确定 as zero", async () => {
    const skipped = await as(E.e8, () => closeMyJob("j14"));
    expect(skipped.ok && skipped.job.hiresConfirmed).toBeUndefined();
    const none = await as(E.e8, () => confirmHires("j14", { hired: false }));
    expect(none.ok && none.job.hiresConfirmed).toBe(0);
  });

  it("corrects the count later on the ended job", async () => {
    const corrected = await as(E.e8, () => confirmHires("j13", { hired: true, count: 3 }));
    expect(corrected.ok && corrected.job.hiresConfirmed).toBe(3);
  });

  it("refuses a bad count, another employer's job and a job that has not ended", async () => {
    expect(await as(E.e8, () => confirmHires("j13", { hired: true, count: 21 }))).toMatchObject({
      ok: false,
      error_zh: "人数请填 1 到 20。",
    });
    expect(await as(E.e3, () => closeMyJob("j15", { hired: true, count: 0 }))).toMatchObject({ ok: false });
    expect((await getJob("j15"))?.status).toBe("active"); // a refused answer does not end the job
    expect(await as(E.e1, () => confirmHires("j13", { hired: true, count: 1 }))).toMatchObject({
      ok: false,
      error_zh: "找不到这个职位。",
    });
    expect(await as(E.e3, () => confirmHires("j15", { hired: true, count: 1 }))).toMatchObject({
      ok: false,
      error_zh: "职位结束后才能记录招到几人。",
    });
  });
});

describe("chatTurn", () => {
  it("runs a turn on the server and rebuilds what the browser sent", async () => {
    const first = await chatTurn(undefined, "招洗碗工");
    expect(first.draft.titleZh).toBe("洗碗工");
    expect(first.asking).toBe("pay");

    const tampered = {
      ...first,
      asking: "launch_rockets",
      ready: true,
      draft: { ...first.draft, status: "active", employerId: "e9", pay: { min: "lots" } },
    };
    const next = await chatTurn(tampered, "25");
    expect(next.draft).not.toHaveProperty("status");
    expect(next.draft).not.toHaveProperty("employerId");
    expect(next.ready).toBe(false);
    expect(next.messages.at(-2)).toMatchObject({ from: "employer", text: "25" });
  });
});

describe("employer identity, checked on the server", () => {
  it("gives an account without a business nothing to read and nothing to change", async () => {
    const seeker = "just.looking@example.com";
    expect(await as(seeker, () => getMyJobs())).toEqual([]);
    expect(await as(seeker, () => getMyJobNumbers())).toEqual({});
    expect(await as(seeker, () => getMyJobDays("j5"))).toBeNull();
    expect(await as(seeker, () => getMyEmployer())).toBeNull();
    expect(await as(seeker, () => closeMyJob("j5"))).toEqual({ ok: false, error_zh: "需要先开通雇主身份。" });
    const { draft } = await parseDraft(MESSAGE);
    expect(await as(seeker, () => publishJob(draft))).toMatchObject({ ok: false, reason: "no_identity" });
  });

  it("acts only for the account's own business, whatever the browser says", async () => {
    // A job of e3, asked for by e2's owner: the session's employerId never reaches the server.
    expect(await as(E.e2, () => getMyJob("j5"))).toBeNull();
    expect(await as(E.e2, () => editMyJob("j5", { titleZh: "x" }))).toEqual({
      ok: false,
      error_zh: "找不到这个职位。",
    });
    expect((await as(E.e3, () => getMyJobs())).every((j) => j.employerId === "e3")).toBe(true);
  });

  it("still shows a banned business to its owner, for the notice", async () => {
    const profile = await as(E.e5, () => getMyEmployer()); // banned in the test above
    expect(profile?.bannedAt).toBeTruthy();
  });
});

describe("refused without the right session (#19)", () => {
  const job = "j5"; // e3's
  const hires = { hired: true, count: 1 } as const;

  /** Every employer Server Function that reads or changes a business, called as the browser is now. */
  async function everything() {
    const { draft } = await parseDraft(MESSAGE);
    return {
      jobs: await getMyJobs(),
      views: await getMyJobNumbers(),
      days: await getMyJobDays(job),
      profile: await getMyEmployer(),
      job: await getMyJob(job),
      publish: await publishJob(draft),
      close: await closeMyJob(job),
      hires: await confirmHires(job, hires),
      refresh: await refreshMyJob(job),
      edit: await editMyJob(job, { titleZh: "改名" }),
      verify: await verifyBusiness("9429000000004"),
    };
  }

  async function untouched() {
    expect(await getJob(job)).toMatchObject({ status: "active", employerId: "e3" });
    expect((await getJob(job))?.titleZh).not.toBe("改名");
  }

  it("refuses a browser that is not signed in, or sends a cookie the server never issued", async () => {
    for (const cookie of [undefined, "made-up-token"]) {
      cookies.clear();
      if (cookie) cookies.set(SESSION_COOKIE, cookie);
      const r = await everything();
      expect(r).toMatchObject({ jobs: [], views: {}, days: null, profile: null, job: null });
      expect(r.publish).toMatchObject({ ok: false, reason: "signed_out" });
      for (const change of [r.close, r.hires, r.refresh, r.edit, r.verify]) {
        expect(change).toEqual({ ok: false, error_zh: "请先登录。" });
      }
    }
    await untouched();
  });

  it("refuses a signed-in account that has no business", async () => {
    const r = await as("seeker.only@example.com", everything);
    expect(r).toMatchObject({ jobs: [], views: {}, days: null, profile: null, job: null });
    expect(r.publish).toMatchObject({ ok: false, reason: "no_identity" });
    for (const change of [r.close, r.hires, r.refresh, r.edit, r.verify]) {
      expect(change).toEqual({ ok: false, error_zh: "需要先开通雇主身份。" });
    }
    await untouched();
  });

  it("refuses another business's job, even when the browser names it", async () => {
    const r = await as(E.e1, everything);
    expect(r.job).toBeNull();
    expect(r.days).toBeNull();
    expect(Object.keys(r.views)).not.toContain(job);
    for (const change of [r.close, r.hires, r.refresh, r.edit]) {
      expect(change).toEqual({ ok: false, error_zh: "找不到这个职位。" });
    }
    expect(r.jobs.every((j) => j.employerId === "e1")).toBe(true);
    await untouched();
  });
});
