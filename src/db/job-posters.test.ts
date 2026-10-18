import { describe, expect, it } from "vitest";
import { listJobContactsBy, listJobPosters, listJobsPostedBy, recordContactBy } from "@/db/job-posters";
import { answerInvite, changeTeam, inviteToTeam } from "@/db/team";
import { deleteAccount } from "@/db/account-data";
import { createEmployer, createJob, ensureAccount, getJob, openEmployerIdentity } from "@/lib/data";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";

function jobFor(employerId: string): Omit<Job, "id"> {
  const job: Partial<Job> = { ...MOCK_JOBS[0] };
  delete job.id;
  return { ...(job as Omit<Job, "id">), employerId, titleZh: "谁发的测试职位", status: "active" };
}

let n = 0;
/** A business with its admin (who set no team name) and two members, 小李 and 小王. */
async function team() {
  n += 1;
  const boss = `posters.boss${n}@example.com`;
  const lee = `posters.lee${n}@example.com`;
  const quiet = `posters.quiet${n}@example.com`;
  for (const email of [boss, lee, quiet]) await ensureAccount(email);
  const employer = await createEmployer({ name: `发布人小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  for (const [email, name] of [
    [lee, "小李"],
    [quiet, "小王"],
  ] as const) {
    const invited = await inviteToTeam(employer.id, boss, email, "member");
    if (invited.status !== "invited") throw new Error(invited.status);
    await answerInvite(email, invited.invite.id, { accept: true, name });
  }
  return { boss, lee, quiet, employer };
}

describe("listJobPosters (#182)", () => {
  it("says who posted each job for the one looking: you, a teammate by name, one who left, a deleted account", async () => {
    const { boss, lee, quiet, employer } = await team();
    const mine = await createJob(jobFor(employer.id), boss);
    const lees = await createJob(jobFor(employer.id), ` ${lee.toUpperCase()} `);
    const quiets = await createJob(jobFor(employer.id), quiet);
    const old = await createJob(jobFor(employer.id));
    expect(await listJobPosters(employer.id, boss)).toEqual({
      teamSize: 3,
      posters: {
        [mine.id]: { kind: "you" },
        [lees.id]: { kind: "teammate", name: "小李" },
        [quiets.id]: { kind: "teammate", name: "小王" },
      },
      contactsFrom: {},
    });
    expect((await listJobPosters(employer.id, lee)).posters[lees.id]).toEqual({ kind: "you" });

    await changeTeam(employer.id, lee, { type: "leave" });
    expect(await deleteAccount(quiet)).toBe("deleted");
    const after = await listJobPosters(employer.id, boss);
    expect(after.teamSize).toBe(1);
    expect(after.posters[lees.id]).toEqual({ kind: "left", email: lee });
    expect(after.posters[quiets.id]).toEqual({ kind: "deleted" });
    expect(after.posters[old.id]).toBeUndefined();
    // The jobs stay up, and a job never carries who posted it.
    expect(await getJob(quiets.id)).toMatchObject({ status: "active" });
    expect(await getJob(lees.id)).not.toHaveProperty("postedBy");
  });

  it("names the admin by email when they set no team name", async () => {
    const { boss, lee, employer } = await team();
    const job = await createJob(jobFor(employer.id), boss);
    expect((await listJobPosters(employer.id, lee)).posters[job.id]).toEqual({ kind: "teammate", name: boss });
  });
});

describe("contact details filled by someone who left (#186)", () => {
  it("lists public contacts of people no longer in the team, until a teammate changes them", async () => {
    const { boss, lee, quiet, employer } = await team();
    const lees = await createJob({ ...jobFor(employer.id), contactPublic: true, contact: { wechat: "lee_wx" } }, lee);
    const leesPrivate = await createJob({ ...jobFor(employer.id), contactPublic: false, contact: {} }, lee);
    const quiets = await createJob(
      { ...jobFor(employer.id), contactPublic: true, contact: { phone: "09 055 0101" } },
      quiet,
    );
    expect((await listJobPosters(employer.id, boss)).contactsFrom).toEqual({});

    await changeTeam(employer.id, lee, { type: "leave" });
    expect(await deleteAccount(quiet)).toBe("deleted");
    expect((await listJobPosters(employer.id, boss)).contactsFrom).toEqual({
      [lees.id]: { kind: "left", email: lee },
      [quiets.id]: { kind: "deleted" },
    });
    expect((await listJobPosters(employer.id, boss)).contactsFrom[leesPrivate.id]).toBeUndefined();

    await recordContactBy(lees.id, boss);
    expect(Object.keys((await listJobPosters(employer.id, boss)).contactsFrom)).toEqual([quiets.id]);
    expect(await listJobContactsBy(boss)).toEqual([{ jobId: lees.id, employerId: employer.id }]);
  });
});

describe("listJobsPostedBy", () => {
  it("lists the account's own jobs, oldest first", async () => {
    const { boss, lee, employer } = await team();
    const job = await createJob(jobFor(employer.id), lee);
    await createJob(jobFor(employer.id), boss);
    expect(await listJobsPostedBy(lee)).toEqual([{ jobId: job.id, employerId: employer.id, postedAt: job.postedAt }]);
  });
});
