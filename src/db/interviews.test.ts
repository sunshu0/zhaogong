import { describe, expect, it } from "vitest";
import { addApplication } from "@/db/job-applications";
import { answerInterview, cancelInterview, interviewsFor, inviteToInterview } from "@/db/interviews";
import { ensureAccount } from "@/lib/data";
import type { ApplicationProfile } from "@/components/seeker/applications";

const PAGE: ApplicationProfile = {
  name: "林晓",
  headline: "",
  location: "",
  languages: "",
  availability: "",
  bio: "",
  resume: { employmentTypes: [], regionIds: [], skills: "" },
};
const INVITE = {
  slots: ["2099-01-05T01:00:00.000Z", "2099-01-06T01:00:00.000Z"],
  callFirst: false,
  mode: "in_person" as const,
  place: "店里",
  note: "",
};
const t0 = new Date("2026-10-17T01:00:00.000Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

async function application(email: string, jobId = "j1") {
  await ensureAccount(email);
  const row = await addApplication({ email, jobId, employerId: "e1", note: "", profile: PAGE });
  if (row === "already") throw new Error("fresh application expected");
  return row;
}

describe("interviews (#103)", () => {
  it("one per application, only the job's business can invite, and changing it opens it again", async () => {
    const app = await application("interview.one@example.com");
    expect(await inviteToInterview("e2", app.id, INVITE, t0)).toBeUndefined();

    const first = await inviteToInterview("e1", app.id, INVITE, t0);
    expect(first).toMatchObject({ status: "proposed", slots: INVITE.slots, invitedAt: t0.toISOString() });
    await answerInterview(app.id, { kind: "counter", reply: "周四下午" }, later(5));

    const changed = await inviteToInterview(
      "e1",
      app.id,
      { ...INVITE, slots: ["2099-01-08T03:00:00.000Z"] },
      later(10),
    );
    expect(changed).toMatchObject({
      id: first!.id,
      status: "proposed",
      slots: ["2099-01-08T03:00:00.000Z"],
      reply: "",
      respondedAt: null,
      invitedAt: later(10).toISOString(),
      createdAt: t0.toISOString(),
    });
    expect((await interviewsFor([app.id])).size).toBe(1);
  });

  it("records the answer only while the invitation is open", async () => {
    const app = await application("interview.answer@example.com");
    await inviteToInterview("e1", app.id, INVITE, t0);
    expect(await answerInterview(app.id, { kind: "confirm", slot: INVITE.slots[1] }, later(1))).toMatchObject({
      status: "confirmed",
      chosenSlot: INVITE.slots[1],
      respondedAt: later(1).toISOString(),
    });
    expect(await answerInterview(app.id, { kind: "decline", reply: "" }, later(2))).toBeUndefined();
    expect((await interviewsFor([app.id])).get(app.id)?.status).toBe("confirmed");
  });

  it("the business cancels", async () => {
    const app = await application("interview.cancel@example.com");
    await inviteToInterview("e1", app.id, INVITE, t0);
    expect(await cancelInterview("e2", app.id, later(1))).toBeUndefined();
    expect(await cancelInterview("e1", app.id, later(1))).toMatchObject({
      status: "cancelled",
      invitedAt: later(1).toISOString(),
    });
  });
});
