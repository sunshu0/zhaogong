import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import {
  banEmployer,
  createEmployer,
  ensureAccount,
  getEmployer,
  listModerationLog,
  openEmployerIdentity,
} from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { latestVerification, submitVerification } from "@/db/verification-requests";
import { myVerificationNotifications } from "@/app/employer/verification-notifications";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { approveVerification, getVerificationQueue, rejectVerification } =
  await import("@/app/admin/verification-actions");

const MODERATOR = "verify.moderator@example.com";
const ALL_CHECKED = {
  register: { done: true },
  applicant: { done: true, note: "董事名单上有" },
  phone: { done: true },
};

async function signIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

let n = 0;
/** A new business that has applied; returns the application's id. */
async function applied(kind: "business_verified" | "accredited_employer" = "business_verified") {
  n += 1;
  const email = `applicant.${n}@example.com`;
  await ensureAccount(email);
  const employer = await createEmployer({ name: `申请小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(email, employer.id);
  const result = await submitVerification(employer, email, {
    nzbn: `94290000${String(80000 + n)}`,
    kind,
    legalName: `Applicant ${n} Limited`,
    contactName: "李经理",
    contactRole: "经理",
    companyPhone: "09 055 0300",
  });
  if (result.status !== "submitted") throw new Error(result.status);
  return { id: result.request.id, employer, email };
}

beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  await ensureAccount(MODERATOR);
  await grantModerator(MODERATOR, null);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("企业验证 in /admin (#78)", () => {
  it("is for moderators only", async () => {
    const { id, employer } = await applied();
    cookies.clear();
    expect(await getVerificationQueue()).toMatchObject({ refused: "signed_out" });
    await signIn("not.a.moderator@example.com");
    expect(await getVerificationQueue()).toMatchObject({ refused: "not_moderator" });
    expect(await approveVerification(id, ALL_CHECKED)).toMatchObject({ ok: false });
    expect(await rejectVerification(id, "other", "说明", {})).toMatchObject({ ok: false });
    expect((await getEmployer(employer.id))?.verification).toBe("unverified");
  });

  it("lists what waits with the register entry and the checklist, and no email", async () => {
    const { id } = await applied("accredited_employer");
    await signIn(MODERATOR);
    const queue = await getVerificationQueue();
    if ("refused" in queue) throw new Error(queue.error_zh);
    const mine = queue.find((i) => i.request.id === id)!;
    expect(mine.checklist.map((c) => c.id)).toContain("accredited");
    expect(JSON.stringify(queue)).not.toMatch(/applicant\.\d+@example\.com/);
  });

  it("approves only when the required items are ticked; the business gets the badge and the log names who", async () => {
    const { id, employer } = await applied();
    await signIn(MODERATOR);
    expect(await approveVerification(id, { register: { done: true } })).toEqual({
      ok: false,
      error_zh: "还有核对项没打勾：申请人身份、电话核实。",
    });
    expect(await approveVerification(id, ALL_CHECKED)).toMatchObject({
      ok: true,
      text: expect.stringContaining("通过企业验证"),
    });
    expect((await getEmployer(employer.id))?.verification).toBe("business_verified");
    expect((await latestVerification(employer.id))?.checklist?.applicant).toEqual({ done: true, note: "董事名单上有" });
    const [last] = await listModerationLog();
    expect(last).toMatchObject({ action: "verify_approve", employerId: employer.id, moderator: MODERATOR });
    expect(await approveVerification(id, ALL_CHECKED)).toMatchObject({ ok: false }); // already decided
  });

  it("rejects only with a reason and a note, which the business keeps", async () => {
    const { id, employer, email } = await applied();
    await signIn(MODERATOR);
    expect(await rejectVerification(id, undefined, "说明", {})).toEqual({ ok: false, error_zh: "请选择驳回理由。" });
    expect(await rejectVerification(id, "impersonation", " ", {})).toMatchObject({ ok: false });
    expect(
      await rejectVerification(id, "impersonation", "登记的董事不认识申请人。", { register: { done: true } }),
    ).toMatchObject({
      ok: true,
    });
    expect(await latestVerification(employer.id)).toMatchObject({
      status: "rejected",
      rejectReason: "impersonation",
      rejectNote: "登记的董事不认识申请人。",
    });
    expect((await getEmployer(employer.id))?.verification).toBe("unverified");
    const [last] = await listModerationLog();
    expect(last).toMatchObject({ action: "verify_reject", note: "冒用他人公司：登记的董事不认识申请人。" });
    // The business hears about it, with the reason, and is linked back to 企业验证.
    expect(await myVerificationNotifications(email, Date.now())).toMatchObject([
      {
        title: "企业验证没有通过",
        detail: "冒用他人公司：登记的董事不认识申请人。改好资料可以重新提交。",
        target: { type: "verification" },
      },
    ]);
  });

  it("does not approve a banned business", async () => {
    const { id, employer } = await applied();
    await banEmployer(employer.id);
    await signIn(MODERATOR);
    expect(await approveVerification(id, ALL_CHECKED)).toEqual({
      ok: false,
      error_zh: "这家店已被封禁，不能通过验证。",
    });
  });
});
