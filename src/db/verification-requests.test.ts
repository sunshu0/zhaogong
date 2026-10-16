import { describe, expect, it } from "vitest";
import {
  decideVerification,
  latestVerification,
  listPendingVerifications,
  submitVerification,
} from "@/db/verification-requests";
import { exportAccountData, deleteAccount } from "@/db/account-data";
import { createEmployer, ensureAccount, getEmployer, openEmployerIdentity } from "@/lib/data";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

const T0 = new Date("2026-10-17T01:00:00.000Z");
let n = 0;

/** A new business with its owner's account, and an application for a fresh NZBN. */
async function shop() {
  n += 1;
  const email = `verify.${n}@example.com`;
  await ensureAccount(email);
  const employer = await createEmployer({ name: `核对小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(email, employer.id);
  const nzbn = `94290000${String(70000 + n)}`;
  const application = {
    nzbn,
    kind: "business_verified" as const,
    legalName: `Check Shop ${n} Limited`,
    contactName: "王店主",
    contactRole: "董事",
    companyPhone: "09 055 0199",
  };
  return { email, employer, nzbn, application };
}

const checked = { register: { done: true }, applicant: { done: true }, phone: { done: true } };

describe("企业验证 applications (#78)", () => {
  it("are pending when submitted, and the badge does not change until a moderator approves", async () => {
    const { email, employer, application } = await shop();
    const result = await submitVerification(employer, email, application, T0);
    expect(result).toMatchObject({ status: "submitted", request: { status: "pending", tradingName: employer.name } });
    expect((await getEmployer(employer.id))?.verification).toBe("unverified");
    expect((await listPendingVerifications()).map((r) => r.employerId)).toContain(employer.id);

    const decided = await decideVerification(
      result.status === "submitted" ? result.request.id : "",
      "Mod@Example.com",
      checked,
      {
        approve: true,
      },
    );
    expect(decided).toMatchObject({ status: "approved", decidedByEmail: "mod@example.com", checklist: checked });
    expect(await getEmployer(employer.id)).toMatchObject({
      verification: "business_verified",
      legalName: application.legalName,
      businessNumber: application.nzbn,
    });
    // Decided once: a second decision changes nothing.
    expect(await decideVerification(decided!.id, "mod@example.com", checked, { approve: true })).toBeUndefined();
  });

  it("allow one pending application per business and per NZBN, and none for an NZBN another business carries", async () => {
    const a = await shop();
    const b = await shop();
    expect((await submitVerification(a.employer, a.email, a.application, T0)).status).toBe("submitted");
    expect((await submitVerification(a.employer, a.email, a.application, T0)).status).toBe("pending");
    expect((await submitVerification(b.employer, b.email, { ...b.application, nzbn: a.nzbn }, T0)).status).toBe(
      "nzbn_pending",
    );
    expect(
      (await submitVerification(b.employer, b.email, { ...b.application, nzbn: "9429000000001" }, T0)).status,
    ).toBe("nzbn_taken"); // 川味小馆's
  });

  it("keep a rejection's reason and note, and let the business apply again", async () => {
    const { email, employer, application } = await shop();
    const first = await submitVerification(employer, email, application, T0);
    const id = first.status === "submitted" ? first.request.id : "";
    const rejection = { reason: "phone_unreachable" as const, note: "公司电话打了两次没人接。" };
    expect(await decideVerification(id, "mod@example.com", checked, { approve: false, rejection })).toMatchObject({
      status: "rejected",
      rejectReason: "phone_unreachable",
      rejectNote: "公司电话打了两次没人接。",
    });
    expect((await getEmployer(employer.id))?.verification).toBe("unverified");
    const again = await submitVerification(employer, email, { ...application, companyPhone: "09 055 0200" }, T0);
    expect(again.status).toBe("submitted");
    expect((await latestVerification(employer.id))?.companyPhone).toBe("09 055 0200");
  });

  it("go into the applicant's data export, and lose the person when the account is deleted", async () => {
    const { email, employer, application } = await shop();
    await submitVerification(employer, email, application, T0);
    const data = await exportAccountData(email);
    expect(data?.verificationRequests).toMatchObject([
      { nzbn: application.nzbn, contactName: "王店主", status: "pending" },
    ]);
    expect(JSON.stringify(data?.verificationRequests)).not.toContain("decidedByEmail");

    expect(await deleteAccount(email)).toBe("deleted");
    const left = await latestVerification(employer.id);
    expect(left).toMatchObject({ status: "withdrawn", submittedByEmail: DELETED_ACCOUNT });
    expect(left?.contactName).not.toBe("王店主");
  });
});
