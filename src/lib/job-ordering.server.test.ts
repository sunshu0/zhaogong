import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, signOut, switchRole, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { banEmployer, ensureAccount, listJobs, openEmployerIdentity, updateJob } from "@/lib/data";
import { saveSeekerProfile } from "@/db/seeker-profiles";
import { parseResume } from "@/lib/candidate-matching";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";
import { jobOrderViewer, orderJobs } from "./job-ordering.server";

const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const jobs = [
  { ...MOCK_JOBS[0], id: "latest", roles: ["cleaner" as const], regionId: "akl-cbd", pay: { min: 25 } },
  { ...MOCK_JOBS[0], id: "older", roles: ["cook" as const], regionId: "akl-albany", pay: { min: 30 } },
];
const now = () => Date.now();
/** As the page does: the viewer is read (for Recommended only), then the list is ordered in memory. */
async function ordered(list: Job[], order: "latest" | "recommended") {
  return orderJobs(list, order, order === "recommended" ? await jobOrderViewer(now()) : null);
}
async function account(email: string, preferences: unknown) {
  await ensureAccount(email);
  await saveSeekerProfile(email, {
    name: "PRIVATE_NAME",
    bio: "PRIVATE_BIO",
    privateDetails: { phone: "PRIVATE_PHONE", wechat: "PRIVATE_WECHAT", email: "PRIVATE_CONTACT" },
    resume: parseResume(preferences),
  });
}

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

describe("request-scoped job ordering", () => {
  it("does not borrow a discoverable person's preferences for a signed-out or empty account", async () => {
    await account("order.other@example.com", { discoverable: true, roles: ["cook"] });
    expect(await ordered(jobs, "recommended")).toEqual({ jobs, status: "signed_out" });
    await ensureAccount("order.empty@example.com");
    await createSession("order.empty@example.com", "seeker", jar);
    expect(await ordered(jobs, "recommended")).toEqual({ jobs, status: "no_preferences" });
  });

  it("uses a private resume, returns only public jobs/status, and isolates logouts and another account", async () => {
    await account("order.a@example.com", { discoverable: false, roles: ["cook"] });
    await account("order.b@example.com", { discoverable: false, regionIds: ["akl-cbd"] });
    await createSession("order.a@example.com", "seeker", jar);
    const a = await ordered(jobs, "recommended");
    expect(a.jobs.map(({ id }) => id)).toEqual(["older", "latest"]);
    expect(a.status).toBe("recommended");
    expect(Object.keys(a).sort()).toEqual(["jobs", "status"]);
    expect(JSON.stringify(a)).not.toMatch(/PRIVATE_|order\.a@|discoverable|expectedMinPay/);
    expect(await ordered(jobs, "latest")).toEqual({ jobs, status: "latest" });
    await signOut(jar);
    expect(await ordered(jobs, "recommended")).toEqual({ jobs, status: "signed_out" });
    await createSession("order.b@example.com", "seeker", jar);
    expect((await ordered(jobs, "recommended")).jobs.map(({ id }) => id)).toEqual(["latest", "older"]);
  });

  it("keeps seeker preferences out of the employer identity and re-reads on switching back", async () => {
    const email = "order.dual@example.com";
    await account(email, { roles: ["cook"] });
    await openEmployerIdentity(email, "e1");
    await createSession(email, "employer", jar);
    expect(await ordered(jobs, "recommended")).toEqual({ jobs, status: "employer" });
    await switchRole("seeker", jar);
    expect((await ordered(jobs, "recommended")).jobs[0].id).toBe("older");
    await switchRole("employer", jar);
    expect(await ordered(jobs, "recommended")).toEqual({ jobs, status: "employer" });
  });

  it("honestly keeps latest when a saved preference has no match, including empty hard-filter results", async () => {
    await account("order.none@example.com", { expectedMinPay: 200 });
    await createSession("order.none@example.com", "seeker", jar);
    expect(await ordered(jobs, "recommended")).toEqual({ jobs, status: "no_matches" });
    // No jobs: nothing to order or explain beside the page's own empty message.
    expect(await ordered([], "recommended")).toEqual({ jobs: [], status: "latest" });
  });

  it("says all_same, not recommended, when every job meets the same preferences", async () => {
    await account("order.same@example.com", { expectedMinPay: 0 });
    await createSession("order.same@example.com", "seeker", jar);
    expect(await ordered(jobs, "recommended")).toEqual({ jobs, status: "all_same" });
  });

  it("only reorders the current hard-filtered open result set", async () => {
    await account("order.filtered@example.com", { roles: ["cook"], expectedMinPay: 30 });
    await createSession("order.filtered@example.com", "seeker", jar);
    const filtered = await listJobs(
      { country: "NZ", regionIds: ["akl-mt-eden"], employmentTypes: ["part_time"] },
      now(),
    );
    expect(filtered.length).toBeGreaterThan(0);
    const result = await ordered(filtered, "recommended");
    expect(result.jobs.map(({ id }) => id).sort()).toEqual(filtered.map(({ id }) => id).sort());
    expect(
      result.jobs.every(
        ({ regionId, employmentType }) => regionId === "akl-mt-eden" && employmentType.includes("part_time"),
      ),
    ).toBe(true);
    await updateJob("j3", { expiresAt: new Date(now() - 1_000).toISOString() });
    await banEmployer("e1");
    const visible = await listJobs({ country: "NZ" }, now());
    const ranked = await ordered(visible, "recommended");
    expect(ranked.jobs.some(({ employerId, id }) => employerId === "e1" || id === "j3")).toBe(false);
  });
});
