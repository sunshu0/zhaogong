import { describe, expect, it } from "vitest";
import { addSentReport, addViewedJob, readSentReports, readViewedJobs } from "@/components/seeker/activity";
import { identityScope, parseIdentityMap } from "@/components/seeker/identity-scope";
import { claimGuestActivity, identityActivityStorage } from "@/components/seeker/identity-activity";
import {
  initialNotifications,
  initialProfile,
  notificationHref,
  parseNotifications,
  parseProfiles,
} from "@/components/seeker/hub-state";
import type { DemoSession, StorageLike } from "@/components/seeker/session";

const seeker: DemoSession = {
  email: "person@example.com",
  activeRole: "seeker",
  signedInAt: "2026-10-13",
  employerId: "e1",
  employerName: "川味小馆",
};
const employer: DemoSession = { ...seeker, activeRole: "employer" };
function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("identity-specific workspace state", () => {
  it("distinguishes identities, accounts and businesses while normalizing email", () => {
    expect(identityScope(seeker)).not.toBe(identityScope(employer));
    expect(identityScope(seeker)).toBe(identityScope({ ...seeker, email: " Person@Example.com " }));
    expect(identityScope(employer)).not.toBe(identityScope({ ...employer, employerId: "e2" }));
    expect(identityScope(seeker)).not.toBe(identityScope({ ...seeker, email: "another@example.com" }));
  });

  it("keeps viewed jobs and reports separate and clears only the chosen identity", () => {
    const storage = memoryStorage();
    const a = identityActivityStorage(storage, identityScope(seeker));
    const b = identityActivityStorage(storage, identityScope(employer));
    const other = identityActivityStorage(storage, identityScope({ ...seeker, email: "another@example.com" }));
    addViewedJob(a, { jobId: "j1", title: "服务员", pay: "$25", region: "Mt Eden", at: "2026-10-13" });
    addSentReport(a, { reportId: "r1", jobId: "j1", jobTitle: "服务员", reason: "fake_job", at: "2026-10-13" });
    addViewedJob(b, { jobId: "j2", title: "厨师", pay: "$28", region: "Albany", at: "2026-10-13" });
    expect(readViewedJobs(a).map((job) => job.jobId)).toEqual(["j1"]);
    expect(readViewedJobs(b).map((job) => job.jobId)).toEqual(["j2"]);
    expect(readSentReports(b)).toEqual([]);
    expect(readViewedJobs(other)).toEqual([]);
    a.removeItem("zhaogong:viewed-jobs");
    expect(readViewedJobs(a)).toEqual([]);
    expect(readViewedJobs(b)).toHaveLength(1);
    expect(readSentReports(a)).toHaveLength(1);
  });

  it("claims guest activity once for the seeker and never copies it to a business or another account", () => {
    const storage = memoryStorage();
    const guest = identityActivityStorage(storage, "guest");
    addViewedJob(guest, { jobId: "j1", title: "服务员", pay: "$25", region: "Mt Eden", at: "2026-10-13" });
    claimGuestActivity(storage, employer);
    expect(readViewedJobs(guest)).toHaveLength(1);
    claimGuestActivity(storage, seeker);
    expect(readViewedJobs(guest)).toEqual([]);
    expect(readViewedJobs(identityActivityStorage(storage, identityScope(seeker)))).toHaveLength(1);
    claimGuestActivity(storage, { ...seeker, email: "another@example.com" });
    expect(
      readViewedJobs(identityActivityStorage(storage, identityScope({ ...seeker, email: "another@example.com" }))),
    ).toEqual([]);
  });

  it("uses company and candidate content for employers and preserves both profiles and notification states", () => {
    const avatar = "data:image/webp;base64,AA==";
    const personal = { ...initialProfile(seeker), name: "我的求职称呼", avatar };
    const company = { ...initialProfile(employer), contactName: "陈经理", avatar: "data:image/png;base64,AA==" };
    expect(company.name).toBe("川味小馆");
    expect(company.bio).toBe("");
    const parsed = parseProfiles(
      JSON.stringify({ [identityScope(seeker)]: personal, [identityScope(employer)]: company, bad: { name: 1 } }),
    );
    expect(Object.keys(parsed)).toHaveLength(2);
    expect(parsed[identityScope(seeker)]).toEqual(personal);
    expect(parsed[identityScope(employer)]).toEqual(company);
    const read = initialNotifications(seeker).map((item) => ({ ...item, unread: false }));
    const hiring = initialNotifications(employer);
    const notifications = parseNotifications(
      JSON.stringify({ [identityScope(seeker)]: read, [identityScope(employer)]: hiring }),
    );
    expect(notifications[identityScope(seeker)].every((item) => !item.unread)).toBe(true);
    expect(notifications[identityScope(employer)].filter((item) => item.unread)).toHaveLength(2);
    expect(hiring[0].title).toContain("林晓");
  });

  it("rejects corrupted stored maps without borrowing another identity's data", () => {
    for (const raw of ["bad json", "null", "[]", '"text"']) expect(parseIdentityMap(raw, () => undefined)).toEqual({});
    expect(parseProfiles('{"bad":{"name":"someone else"}}')).toEqual({});
    const base = { ...initialProfile(seeker) };
    for (const avatar of [
      "https://example.com/a.png",
      "data:image/svg+xml;base64,AA==",
      `data:image/png;base64,${"A".repeat(180_000)}`,
    ]) {
      const parsed = parseProfiles(JSON.stringify({ [identityScope(seeker)]: { ...base, avatar } }));
      expect(parsed[identityScope(seeker)]?.avatar).toBeUndefined();
      expect(parsed[identityScope(seeker)]?.name).toBe(base.name);
    }
    expect(parseNotifications('{"bad":[{"unread":"true"}]}')).toEqual({});
  });

  it("resolves saved legacy notifications using only the current identity's demo targets", () => {
    const legacy = initialNotifications(seeker).map((item) => ({ ...item, target: undefined }));
    const parsed = parseNotifications(JSON.stringify({ [identityScope(seeker)]: legacy }))[identityScope(seeker)];
    expect(parsed.map((item) => notificationHref(item, seeker))).toEqual([
      "/messages?conversation=north-tea",
      "/messages?conversation=mt-eden",
      "/messages?conversation=clean-home",
    ]);
    expect(notificationHref(parsed[0], employer)).toBeUndefined();
    expect(notificationHref(parsed[0], null)).toBeUndefined();
    expect(notificationHref(initialNotifications(employer)[2], employer)).toBe("/profile");
  });

  it("preserves explicit targets and safely encodes dynamic conversation IDs", () => {
    const item = { ...initialNotifications(seeker)[0], target: { type: "conversation", id: "employer:e1:j1&other=1" } };
    const parsed = parseNotifications(JSON.stringify({ [identityScope(seeker)]: [item] }))[identityScope(seeker)][0];
    expect(notificationHref(parsed, seeker)).toBe("/messages?conversation=employer%3Ae1%3Aj1%26other%3D1");
    expect(parsed.target).toEqual(item.target);
    for (const target of [
      "https://example.com",
      { type: "conversation", id: 1 },
      { type: "conversation", id: " " },
      { type: "url", href: "https://example.com" },
    ]) {
      const invalid = { ...item, id: "unknown", target };
      const cleaned = parseNotifications(JSON.stringify({ [identityScope(seeker)]: [invalid] }))[
        identityScope(seeker)
      ][0];
      expect(cleaned.target).toBeUndefined();
      expect(notificationHref(cleaned, seeker)).toBeUndefined();
      expect(cleaned.unread).toBe(true);
    }
  });
});
