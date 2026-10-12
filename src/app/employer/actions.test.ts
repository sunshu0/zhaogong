import { beforeAll, describe, expect, it } from "vitest";
import {
  chatTurn,
  closeMyJob,
  confirmHires,
  editMyJob,
  getContactViewCounts,
  getMyEmployer,
  getMyJob,
  getMyJobs,
  lookupBusiness,
  parseDraft,
  publishJob,
  refreshMyJob,
  verifyBusiness,
} from "@/app/employer/actions";
import { banEmployer, getJob, getPlatformStats, listJobs, openEmployerIdentity, recordContactView } from "@/lib/data";

/** The signed-in email of each demo business's owner: the Server Functions take the email, the server finds the business. */
const E: Record<string, string> = {};
beforeAll(async () => {
  for (const id of ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"]) {
    const email = `owner.${id}@example.com`;
    const opened = await openEmployerIdentity(email, id);
    if (!opened.ok) throw new Error(`${id}: ${opened.reason}`);
    E[id] = email;
  }
});

const MESSAGE = `Mt Eden 川菜馆招前厅服务员，时薪 $25-27，每周 15-25 小时，包工作餐，学签可做。微信 demo_chuanwei`;

describe("publishJob", () => {
  it("publishes a clean draft as active, visible to job seekers", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const result = await publishJob(draft, E.e1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job).toMatchObject({ employerId: "e1", status: "active", titleZh: "前厅服务员" });
    expect((await listJobs({ country: "NZ" })).map((j) => j.id)).toContain(result.job.id);
    expect((await getMyJobs(E.e1))[0].id).toBe(result.job.id);
  });

  it("sends a high-risk draft to review instead of the list", async () => {
    const { draft } = await parseDraft(`${MESSAGE}，KTV 包间`);
    const result = await publishJob(draft, E.e1);
    expect(result.ok && result.job.status).toBe("pending_review");
  });

  it("re-checks on the server and refuses what the browser should have held back", async () => {
    const { draft } = await parseDraft(MESSAGE.replace("$25-27", "$20"));
    const result = await publishJob({ ...draft, descriptionZh: "入职交押金。" }, E.e1);
    expect(result).toMatchObject({ ok: false, reason: "not_ready" });
    expect(!result.ok && result.findings.map((f) => f.rule)).toEqual(["min_wage", "fee"]);
  });

  it("refuses an incomplete draft and an unknown employer", async () => {
    expect(await publishJob({ titleZh: "洗碗工" }, E.e1)).toMatchObject({ ok: false, reason: "not_ready" });
    const { draft } = await parseDraft(MESSAGE);
    expect(await publishJob(draft, "nobody@example.com")).toMatchObject({ ok: false, reason: "no_identity" });
  });

  it("ignores fields the browser should not set", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const result = await publishJob({ ...draft, status: "active", employerId: E.e2, id: "j1" }, E.e1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job.employerId).toBe("e1");
    expect(result.job.id).not.toBe("j1");
    expect((await getJob("j1"))?.titleZh).toBe("前厅服务员"); // the demo job is untouched
  });
});

describe("managing published jobs", () => {
  it("only lets the owner see or change a job", async () => {
    expect(await getMyJob("j1", E.e2)).toBeNull();
    expect((await getMyJob("j1", E.e1))?.id).toBe("j1");
    expect(await closeMyJob("j1", E.e2)).toMatchObject({ ok: false, error_zh: "找不到这个职位。" });
  });

  it("closes a job, takes it off the list, and refreshing reopens it for 30 days", async () => {
    const closed = await closeMyJob("j2", E.e1);
    expect(closed.ok && closed.job.status).toBe("expired");
    expect((await listJobs({ country: "NZ" })).map((j) => j.id)).not.toContain("j2");

    const reopened = await refreshMyJob("j2", E.e1);
    expect(reopened.ok && reopened.job.status).toBe("active");
    expect(reopened.ok && Date.parse(reopened.job.expiresAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect(await refreshMyJob("j2", E.e1)).toMatchObject({ ok: false, error_zh: "不能刷新：今天已刷新过" });
  });

  it("saves an edit after the same checks, and sends risky new text back to review", async () => {
    const job = (await getMyJob("j3", E.e2))!;
    const blocked = await editMyJob("j3", E.e2, { ...job, descriptionZh: "包签，月入过万。" });
    expect(blocked).toMatchObject({ ok: false });
    expect(!blocked.ok && blocked.findings?.map((f) => f.rule)).toEqual(["visa_selling"]);

    const edited = await editMyJob("j3", E.e2, { ...job, titleZh: "点心主厨", shiftsZh: undefined, descriptionZh: "早茶点心，附近有 KTV。" });
    expect(edited.ok && edited.job).toMatchObject({ id: "j3", titleZh: "点心主厨", status: "pending_review", postedAt: job.postedAt });
    expect(edited.ok && edited.job.shiftsZh).toBeUndefined();
  });

  it("counts contact reveals per job without saying who", async () => {
    await recordContactView("j4", "a@example.com");
    await recordContactView("j4", "b@example.com");
    const counts = await getContactViewCounts(E.e2);
    expect(counts.j4).toBe(2);
    expect(JSON.stringify(counts)).not.toContain("@");
  });

  it("stops a banned employer from posting or editing", async () => {
    await banEmployer("e5");
    const { draft } = await parseDraft(MESSAGE);
    expect(await publishJob(draft, E.e5)).toMatchObject({ ok: false, reason: "banned" });
    expect(await refreshMyJob("j8", E.e5)).toMatchObject({ ok: false, error_zh: "账号已被停用，不能再修改职位。" });
  });
});

describe("business verification", () => {
  it("looks up the demo register by name or NZBN", async () => {
    expect((await lookupBusiness("悦美")).results.map((e) => e.nzbn)).toEqual(["9429000000004"]);
    expect((await lookupBusiness("123")).error_zh).toContain("13 位");
  });

  it("verifies an unverified shop with its register entry", async () => {
    const result = await verifyBusiness(E.e4, "9429 0000 0000 4");
    expect(result.ok && result.employer).toMatchObject({ verification: "business_verified", legalName: "Demo Yuemei Hair Studio Limited" });
    expect(await getMyEmployer(E.e4)).toMatchObject({ verification: "business_verified", businessNumber: "9429000000004" });
  });

  it("refuses a struck-off company, an unknown number and another shop's NZBN", async () => {
    expect(await verifyBusiness(E.e6, "9429000000099")).toMatchObject({ ok: false, error_zh: expect.stringContaining("已注销") });
    expect(await verifyBusiness(E.e6, "9429000000123")).toMatchObject({ ok: false });
    expect(await verifyBusiness(E.e6, "9429000000001")).toMatchObject({ ok: false, error_zh: expect.stringContaining("其他店铺") });
    expect((await getMyEmployer(E.e6))?.verification).toBe("unverified");
  });

  it("keeps an accredited employer's badge", async () => {
    const result = await verifyBusiness(E.e2, "9429000000002");
    expect(result.ok && result.employer.verification).toBe("accredited_employer");
  });
});

describe("hires confirmed when a job ends", () => {
  it("saves the count with the close, and the platform total adds it up", async () => {
    const before = (await getPlatformStats("NZ")).hiresConfirmed;
    const closed = await closeMyJob("j13", E.e8, { hired: true, count: 2 });
    expect(closed.ok && closed.job).toMatchObject({ status: "expired", hiresConfirmed: 2 });
    expect(closed.ok && closed.job.hiresConfirmedAt).toBeTruthy();
    expect((await getPlatformStats("NZ")).hiresConfirmed).toBe(before + 2);
  });

  it("ends a job without an answer, and records 没有 / 不确定 as zero", async () => {
    const skipped = await closeMyJob("j14", E.e8);
    expect(skipped.ok && skipped.job.hiresConfirmed).toBeUndefined();
    const none = await confirmHires("j14", E.e8, { hired: false });
    expect(none.ok && none.job.hiresConfirmed).toBe(0);
  });

  it("corrects the count later on the ended job", async () => {
    const corrected = await confirmHires("j13", E.e8, { hired: true, count: 3 });
    expect(corrected.ok && corrected.job.hiresConfirmed).toBe(3);
  });

  it("refuses a bad count, another employer's job and a job that has not ended", async () => {
    expect(await confirmHires("j13", E.e8, { hired: true, count: 21 })).toMatchObject({ ok: false, error_zh: "人数请填 1 到 20。" });
    expect(await closeMyJob("j15", E.e3, { hired: true, count: 0 })).toMatchObject({ ok: false });
    expect((await getJob("j15"))?.status).toBe("active"); // a refused answer does not end the job
    expect(await confirmHires("j13", E.e1, { hired: true, count: 1 })).toMatchObject({ ok: false, error_zh: "找不到这个职位。" });
    expect(await confirmHires("j15", E.e3, { hired: true, count: 1 })).toMatchObject({ ok: false, error_zh: "职位结束后才能记录招到几人。" });
  });
});

describe("chatTurn", () => {
  it("runs a turn on the server and rebuilds what the browser sent", async () => {
    const first = await chatTurn(undefined, "招洗碗工");
    expect(first.draft.titleZh).toBe("洗碗工");
    expect(first.asking).toBe("pay");

    const tampered = { ...first, asking: "launch_rockets", ready: true, draft: { ...first.draft, status: "active", employerId: "e9", pay: { min: "lots" } } };
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
    expect(await getMyJobs(seeker)).toEqual([]);
    expect(await getContactViewCounts(seeker)).toEqual({});
    expect(await getMyEmployer(seeker)).toBeNull();
    expect(await closeMyJob("j5", seeker)).toEqual({ ok: false, error_zh: "需要先开通雇主身份。" });
    const { draft } = await parseDraft(MESSAGE);
    expect(await publishJob(draft, seeker)).toMatchObject({ ok: false, reason: "no_identity" });
    expect(await publishJob(draft, "")).toMatchObject({ ok: false, reason: "no_identity" });
  });

  it("acts only for the account's own business, whatever the browser says", async () => {
    // A job of e3, asked for by e2's owner: the session's employerId never reaches the server.
    expect(await getMyJob("j5", E.e2)).toBeNull();
    expect(await editMyJob("j5", E.e2, { titleZh: "x" })).toEqual({ ok: false, error_zh: "找不到这个职位。" });
    expect((await getMyJobs(E.e3)).every((j) => j.employerId === "e3")).toBe(true);
  });

  it("still shows a banned business to its owner, for the notice", async () => {
    const profile = await getMyEmployer(E.e5); // banned in the test above
    expect(profile?.bannedAt).toBeTruthy();
  });
});
