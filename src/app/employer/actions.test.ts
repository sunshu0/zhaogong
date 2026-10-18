import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, SESSION_COOKIE, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { startChat } from "@/lib/ai-post";
import { recordChatStart, recordJobView } from "@/db/job-stats";
import {
  banEmployer,
  createEmployer,
  ensureAccount,
  getJob,
  getPlatformStats,
  listJobs,
  openEmployerIdentity,
  recordContactView,
  updateJob,
} from "@/lib/data";
import { createJobAlert, listJobAlertHits } from "@/db/job-alerts";
import { countAiCalls, listAiUsageOf } from "@/db/ai-usage";

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
  getMyJobPosters,
  getMyJobRenewals,
  getMyEmployer,
  getMyJob,
  getMyJobs,
  lookupBusiness,
  parseDraft,
  publishJob,
  refreshMyJob,
  renewMyJob,
  requestVerification,
  getMyVerification,
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
    expect((await listJobs({ country: "NZ" }, Date.now())).map((j) => j.id)).toContain(result.job.id);
    expect((await as(E.e1, () => getMyJobs()))[0].id).toBe(result.job.id);
  });

  it("records the session's account as who posted it, for the team's eyes only (#182)", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const result = await as(E.e2, () => publishJob(draft));
    if (!result.ok) throw new Error(result.reason);
    expect(result.job).not.toHaveProperty("postedBy");
    expect((await as(E.e2, () => getMyJobPosters())).posters[result.job.id]).toEqual({ kind: "you" });
    cookies.clear();
    expect(await getMyJobPosters()).toEqual({ teamSize: 0, posters: {} });
  });

  it("sends a high-risk draft to review instead of the list", async () => {
    const { draft } = await parseDraft(`${MESSAGE}，KTV 包间`);
    const result = await as(E.e1, () => publishJob(draft));
    expect(result.ok && result.job.status).toBe("pending_review");
  });

  it("tells job seekers whose alerts match, once the job is live (#53)", async () => {
    await ensureAccount("alert.seeker@example.com");
    await createJobAlert("alert.seeker@example.com", { name: "前厅", country: "NZ", query: "q=前厅服务员" });
    const found = async () => (await listJobAlertHits("alert.seeker@example.com")).map((hit) => hit.jobId);

    const review = await as(E.e1, async () => publishJob((await parseDraft(`${MESSAGE}，KTV 包间`)).draft));
    expect(review.ok && (await found()).includes(review.job.id)).toBe(false);
    const live = await as(E.e1, async () => publishJob((await parseDraft(MESSAGE)).draft));
    expect(live.ok && (await found()).includes(live.job.id)).toBe(true);
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

  it("closes a job and takes it off the list; renewing, not refreshing, reopens it (#69)", async () => {
    const closed = await as(E.e1, () => closeMyJob("j2"));
    expect(closed.ok && closed.job.status).toBe("expired");
    expect((await listJobs({ country: "NZ" }, Date.now())).map((j) => j.id)).not.toContain("j2");
    expect(await as(E.e1, () => refreshMyJob("j2"))).toMatchObject({
      ok: false,
      error_zh: "不能刷新：已截止，不能刷新",
    });

    const reopened = await as(E.e1, () => renewMyJob("j2", 30));
    expect(reopened.ok && reopened.job.status).toBe("active");
    expect(reopened.ok && Date.parse(reopened.job.expiresAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect((await listJobs({ country: "NZ" }, Date.now())).map((j) => j.id)).toContain("j2");
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
    expect(await as(E.e5, () => renewMyJob("j8", 30))).toMatchObject({
      ok: false,
      error_zh: "账号已被停用，不能再修改职位。",
    });
    expect(
      await as(E.e5, () =>
        requestVerification({
          nzbn: "9429999000555",
          contactName: "刘",
          contactRole: "董事",
          companyPhone: "09 055 0105",
        }),
      ),
    ).toEqual({ ok: false, error_zh: "账号已被停用，不能申请验证。" }); // #78
  });
});

describe("renewing a job (#69)", () => {
  const DAY = 86_400_000;
  /** One of e4's demo jobs, closing `days` from now (negative: closed that long ago). */
  async function closingIn(days: number, status: "active" | "expired" = "active") {
    const id = "j7";
    await updateJob(id, { status, expiresAt: new Date(Date.now() + days * DAY).toISOString() });
    return (await getJob(id))!;
  }

  it("pushes the closing date back from the old one, keeps the job's place, and records it", async () => {
    const job = await closingIn(2);
    const renewed = await as(E.e4, () => renewMyJob(job.id, 14));
    expect(renewed.ok && renewed.job).toMatchObject({
      status: "active",
      postedAt: job.postedAt,
      expiresAt: new Date(Date.parse(job.expiresAt) + 14 * DAY).toISOString(),
    });
    const counts = await as(E.e4, () => getMyJobRenewals());
    expect(counts[job.id].count).toBeGreaterThanOrEqual(1);
    expect(await as(E.e1, () => getMyJobRenewals())).not.toHaveProperty(job.id);
  });

  it("reopens a job up to 14 days after it closed, counting from today", async () => {
    await closingIn(-10);
    const renewed = await as(E.e4, () => renewMyJob("j7", 60));
    expect(renewed.ok && renewed.job.status).toBe("active");
    expect(renewed.ok && Math.round((Date.parse(renewed.job.expiresAt) - Date.now()) / DAY)).toBe(60);
  });

  it("refuses a job closed longer ago, a length not offered, and a date beyond 90 days", async () => {
    await closingIn(-15);
    expect(await as(E.e4, () => renewMyJob("j7", 30))).toEqual({
      ok: false,
      error_zh: "不能续期：截止超过 14 天，不能续期",
    });
    await closingIn(10);
    expect(await as(E.e4, () => renewMyJob("j7", 45))).toEqual({ ok: false, error_zh: "请选择续期 14、30 或 60 天。" });
    await closingIn(40);
    expect(await as(E.e4, () => renewMyJob("j7", 60))).toEqual({
      ok: false,
      error_zh: "续期 60 天会超过最远的截止日，请选短一些的。",
    });
    expect((await getJob("j7"))?.status).toBe("active");
  });

  it("checks the job against today's rules first", async () => {
    const job = await closingIn(-3, "expired");
    await updateJob(job.id, { pay: { ...job.pay, min: 10, max: 11 } });
    const refused = await as(E.e4, () => renewMyJob(job.id, 30));
    expect(refused).toMatchObject({ ok: false, error_zh: "这个职位不符合现在的发布规则，请先编辑。" });
    expect(!refused.ok && refused.findings?.map((f) => f.rule)).toContain("min_wage");
    expect((await getJob(job.id))?.status).toBe("expired");
    await updateJob(job.id, { pay: job.pay });
  });
});

describe("business verification", () => {
  it("looks up the demo register by name or NZBN", async () => {
    expect((await lookupBusiness("悦美")).results.map((e) => e.nzbn)).toEqual(["9429000000004"]);
    expect((await lookupBusiness("123")).error_zh).toContain("13 位");
  });

  const form = { contactName: "陈美", contactRole: "店主", companyPhone: "09 055 0106" };

  it("applies for 已验证企业 and waits for a moderator: the badge does not change (#78)", async () => {
    const result = await as(E.e6, () => requestVerification({ ...form, nzbn: "9429 0000 0000 6" }));
    expect(result.ok && result.request).toMatchObject({
      status: "pending",
      kind: "business_verified",
      legalName: "Demo Jiejing Home Services Limited",
      tradingName: "洁净家政",
    });
    expect(JSON.stringify(result)).not.toContain("@");
    expect((await as(E.e6, () => getMyEmployer()))?.verification).toBe("unverified");
    expect(await as(E.e6, () => getMyVerification())).toMatchObject({ status: "pending" });
    expect(await as(E.e6, () => requestVerification({ ...form, nzbn: "9429000000006" }))).toEqual({
      ok: false,
      error_zh: "你已经有一份验证申请在审核中，审核员核对后会通知你。",
    });
  });

  it("refuses a struck-off company, an unknown number, another shop's NZBN and a missing phone", async () => {
    const shop = await createEmployer({ name: "新开小店", regionId: "akl-cbd" });
    await openEmployerIdentity("new.shop@example.com", shop.id);
    const apply = (input: object) => as("new.shop@example.com", () => requestVerification({ ...form, ...input }));
    expect(await apply({ nzbn: "9429000000099" })).toMatchObject({
      ok: false,
      error_zh: expect.stringContaining("已注销"),
    });
    expect(await apply({ nzbn: "9429000000123" })).toEqual({ ok: false, error_zh: "企业登记里没有这个 NZBN。" });
    expect(await apply({ nzbn: "9429000000001" })).toMatchObject({
      ok: false,
      error_zh: expect.stringContaining("其他店铺"),
    });
    expect(await apply({ nzbn: "9429000000006" })).toMatchObject({
      ok: false,
      error_zh: expect.stringContaining("审核中"),
    }); // e6's, above
    expect(await apply({ nzbn: "9429000000010", companyPhone: "" })).toMatchObject({ ok: false });
    expect(await as("new.shop@example.com", () => getMyVerification())).toBeNull();
  });

  it("only offers a badge the business does not have yet", async () => {
    expect(
      await as(E.e2, () => requestVerification({ ...form, nzbn: "9429000000002", kind: "accredited_employer" })),
    ).toEqual({
      ok: false,
      error_zh: "你的店铺已经是「认证雇主」。",
    });
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

  // #102: with a model (the fake here), each call is recorded and the account's limits hold.
  const withFake = <T>(call: () => Promise<T>) => {
    cookies.set("zg_ai_fake", "1");
    return call();
  };

  it("records each call to the model with its tokens and how it ended; the script is not counted", async () => {
    const email = "ai.counted@example.com";
    await as(email, () => chatTurn(undefined, "招洗碗工"));
    expect(await listAiUsageOf(email)).toEqual([]);

    const first = await as(email, () => withFake(() => chatTurn(undefined, "招洗碗工，时薪 25")));
    expect(first.unavailable).toBe(false);
    await as(email, () => withFake(() => chatTurn(first, "招服务员【测试：出错】")));
    const rows = await listAiUsageOf(email);
    expect(rows.map((r) => [r.model, r.result])).toEqual([
      ["fake", "ok"],
      ["fake", "error"],
    ]);
    expect(rows[0].input).toBeGreaterThan(0);
  });

  it("stops at 6 calls a minute without calling the model, and says so with the form offered", async () => {
    const email = "ai.limited@example.com";
    let chat = await as(email, () => withFake(() => chatTurn(undefined, "招洗碗工")));
    for (let i = 0; i < 5; i += 1) chat = await as(email, () => withFake(() => chatTurn(chat, "时薪 25")));
    expect(await countAiCalls(email)).toMatchObject({ lastMinute: 6 });

    const turned = await as(email, () => withFake(() => chatTurn(chat, "在 Mt Eden")));
    expect(turned.unavailable).toBe(true);
    expect(turned.messages.at(-1)?.text).toContain("一分钟最多回答 6 句");
    expect(turned.draft).toEqual(chat.draft);
    expect((await listAiUsageOf(email)).map((r) => r.result).slice(-2)).toEqual(["ok", "limited"]);
    // A call turned away is not counted against the limit itself.
    expect(await countAiCalls(email)).toMatchObject({ lastMinute: 6 });
  });

  it("asks to sign in before the model is called, and records nothing", async () => {
    const said = await withFake(() => chatTurn(undefined, "招洗碗工"));
    expect(said.unavailable).toBe(true);
    expect(said.messages.at(-1)?.text).toContain("登录后才能用 AI 发帖助手");
    expect(said.draft.titleZh).toBeUndefined();
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
      renew: await renewMyJob(job, 30),
      renewals: await getMyJobRenewals(),
      edit: await editMyJob(job, { titleZh: "改名" }),
      verify: await requestVerification({
        nzbn: "9429000000004",
        contactName: "冒名",
        contactRole: "店主",
        companyPhone: "09 055 0000",
      }),
      verification: await getMyVerification(),
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
      expect(r).toMatchObject({
        jobs: [],
        views: {},
        renewals: {},
        days: null,
        profile: null,
        job: null,
        verification: null,
      });
      expect(r.publish).toMatchObject({ ok: false, reason: "signed_out" });
      for (const change of [r.close, r.hires, r.refresh, r.renew, r.edit, r.verify]) {
        expect(change).toEqual({ ok: false, error_zh: "请先登录。" });
      }
    }
    await untouched();
  });

  it("refuses a signed-in account that has no business", async () => {
    const r = await as("seeker.only@example.com", everything);
    expect(r).toMatchObject({
      jobs: [],
      views: {},
      renewals: {},
      days: null,
      profile: null,
      job: null,
      verification: null,
    });
    expect(r.publish).toMatchObject({ ok: false, reason: "no_identity" });
    for (const change of [r.close, r.hires, r.refresh, r.renew, r.edit, r.verify]) {
      expect(change).toEqual({ ok: false, error_zh: "需要先开通雇主身份。" });
    }
    await untouched();
  });

  it("refuses another business's job, even when the browser names it", async () => {
    const r = await as(E.e1, everything);
    expect(r.job).toBeNull();
    expect(r.days).toBeNull();
    expect(Object.keys(r.views)).not.toContain(job);
    for (const change of [r.close, r.hires, r.refresh, r.renew, r.edit]) {
      expect(change).toEqual({ ok: false, error_zh: "找不到这个职位。" });
    }
    expect(r.jobs.every((j) => j.employerId === "e1")).toBe(true);
    await untouched();
  });
});
