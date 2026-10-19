import { describe, expect, it } from "vitest";
import { myApplicationNotifications } from "@/app/[lang]/employer/application-notifications";
import { addApplication, markApplicationsSeen } from "@/db/job-applications";
import { createEmployer, createJob, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";

let n = 0;

const profile = (name: string) => ({
  name,
  headline: "",
  location: "",
  languages: "",
  availability: "",
  bio: "",
  resume: { skills: "", employmentTypes: [], regionIds: [] },
});

/** A new business with its founder and one open job of its own. */
async function shopWithJob(title: string) {
  n += 1;
  const boss = `apply.notify.boss${n}@example.com`;
  await ensureAccount(boss);
  const employer = await createEmployer({ name: `申请通知小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  const base: Partial<Job> = { ...MOCK_JOBS[0] };
  delete base.id;
  const job = await createJob({
    ...(base as Omit<Job, "id">),
    employerId: employer.id,
    titleZh: title,
    status: "active",
  });
  return { boss, employer, job };
}

async function apply(email: string, job: Job, note: string, name: string, at: Date) {
  await ensureAccount(email);
  const row = await addApplication({
    email,
    jobId: job.id,
    employerId: job.employerId,
    note,
    profile: profile(name),
    now: at,
  });
  if (row === "already") throw new Error("applied twice");
  return row;
}

describe("application notifications (#278)", () => {
  it("has one per application, newest first, read once the business has looked at the job's applicants", async () => {
    const { boss, employer, job } = await shopWithJob("通知测试洗碗工");
    const now = Date.now();
    await apply(`apply.notify.a${n}@example.com`, job, "周末都能上班", "王小明", new Date(now - 7_200_000));
    await apply(`apply.notify.b${n}@example.com`, job, "", "李华", new Date(now - 60_000));

    let items = await myApplicationNotifications(boss, now);
    expect(items.map((item) => item.title)).toEqual(["李华申请了通知测试洗碗工", "王小明申请了通知测试洗碗工"]);
    expect(items.map((item) => item.detail)).toEqual(["点开看对方的资料", "附言：周末都能上班"]);
    expect(items.every((item) => item.unread && item.type === "申请")).toBe(true);
    expect(items[0].target).toEqual({ type: "applicants", jobId: job.id });

    // Opening 申请人 marks them seen: from then on they count as read.
    await markApplicationsSeen(employer.id, job.id);
    items = await myApplicationNotifications(boss, now);
    expect(items.map((item) => item.unread)).toEqual([false, false]);
  });

  it("has nothing for an account without a business", async () => {
    await ensureAccount("apply.notify.nobody@example.com");
    expect(await myApplicationNotifications("apply.notify.nobody@example.com", Date.now())).toEqual([]);
  });
});
