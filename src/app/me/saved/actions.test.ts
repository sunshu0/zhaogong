import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { ensureAccount, updateJob } from "@/lib/data";
import { EMPTY_CHAT } from "@/components/seeker/chat-store";
import { identityScope } from "@/components/seeker/identity-scope";
import { externalSaveKey } from "@/components/seeker/saved-jobs";
import { setExternalReview } from "@/db/external-jobs";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { mySavedJobIds, mySavedJobs, saveMyJob, setMyJobStage, unsaveMyJob } = await import("@/app/me/saved/actions");

let chats = memoryChatStore();

async function signedIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

beforeEach(() => {
  setAuthStoreForTests();
  chats = memoryChatStore();
  setChatServerStoreForTests(chats);
  cookies.clear();
});

describe("收藏和进度 on the server (#52)", () => {
  it("is nothing for a signed-out browser", async () => {
    expect(await mySavedJobIds()).toBeNull();
    expect(await mySavedJobs()).toBeNull();
    expect(await saveMyJob("j3")).toBeNull();
    expect(await setMyJobStage("j3", "hired")).toBeNull();
  });

  it("saves and removes for the account in the cookie only", async () => {
    await signedIn("li@example.com");
    expect(await saveMyJob("j3")).toEqual(["j3"]);
    expect(await saveMyJob("j5")).toEqual(["j5", "j3"]);
    expect(await unsaveMyJob("j3")).toEqual(["j5"]);

    await signedIn("someone.else@example.com");
    expect(await mySavedJobIds()).toEqual([]);
    expect(await mySavedJobs()).toEqual([]);
  });

  it("lists each job with what the page needs and 已收藏 to start with", async () => {
    await signedIn("wang@example.com");
    await saveMyJob("j3");
    const [j3] = (await mySavedJobs())!;
    expect(j3).toMatchObject({
      jobId: "j3",
      titleZh: "点心师傅",
      titleEn: "Dim sum chef",
      region: "Northcote",
      employerName: "北岸早茶酒家",
      gone: false,
      stage: "saved",
      picked: false,
    });
    expect(j3.pay?.min).toBe(30);
  });

  it("marks a job 已联系 once its chat swapped contact details; a stage the user picks wins", async () => {
    await signedIn("demo.chen@example.com");
    await saveMyJob("j3"); // north-tea is the demo chat about j3
    const scope = identityScope({ email: "demo.chen@example.com", signedInAt: "", activeRole: "seeker" });
    await chats.putChat(scope, {
      ...EMPTY_CHAT,
      exchanges: {
        "north-tea": [
          {
            id: "x1",
            kind: "contact",
            from: "me",
            status: "accepted",
            offered: { title: "联系方式", fields: [{ label: "电话", value: "09 000 0000" }] },
            createdAt: "2026-10-16T00:00:00.000Z",
          },
        ],
      },
    });
    expect((await mySavedJobs())![0]).toMatchObject({ stage: "contacted", picked: false });
    expect((await setMyJobStage("j3", "saved"))![0]).toMatchObject({ stage: "saved", picked: true });
    expect((await setMyJobStage("j3", "interviewed"))![0]).toMatchObject({ stage: "interviewed", picked: true });
    expect((await setMyJobStage("j3", "offer" as never))![0].stage).toBe("interviewed"); // not a stage: unchanged
  });

  it("keeps a job that was taken down, marked gone", async () => {
    await signedIn("zhao@example.com");
    await saveMyJob("j11");
    await updateJob("j11", { status: "removed" });
    expect((await mySavedJobs())![0]).toMatchObject({ jobId: "j11", gone: true });
  });
});

describe("收藏 for external jobs (#131)", () => {
  const grad = "demo-kowhai:4001"; // Graduate Software Engineer, approved
  const pending = "demo-kowhai:4002"; // Senior Electronics Engineer, waiting for review

  it("saves a job the sections show, in the same list as the job list's, under its save key", async () => {
    await signedIn("ext.saver@example.com");
    await saveMyJob("j3");
    expect(await saveMyJob(externalSaveKey(grad))).toEqual(expect.arrayContaining(["j3", `external:${grad}`]));
    expect(await saveMyJob(externalSaveKey(pending))).not.toContain(`external:${pending}`);
    const list = (await mySavedJobs())!;
    expect(list.map((job) => job.jobId)).toEqual([`external:${grad}`, "j3"]); // newest first
    expect(list[0]).toMatchObject({
      href: "/external/demo-kowhai%3A4001",
      external: true,
      titleZh: "Graduate Software Engineer",
      titleEn: "",
      employerName: "Kōwhai Robotics",
      region: "奥克兰",
      gone: false,
      stage: "saved",
      picked: false,
    });
    expect(list[1]).toMatchObject({ jobId: "j3", href: "/jobs/j3", external: false });
  });

  it("keeps its stage, marks it 已下架 once it stops showing, and removes it", async () => {
    await signedIn("ext.stage@example.com");
    await saveMyJob(externalSaveKey(grad));
    const [picked] = (await setMyJobStage(externalSaveKey(grad), "interviewed"))!;
    expect(picked).toMatchObject({ stage: "interviewed", picked: true });

    await setExternalReview(grad, "hidden");
    try {
      expect((await mySavedJobs())![0]).toMatchObject({ jobId: `external:${grad}`, gone: true });
    } finally {
      await setExternalReview(grad, "approved");
    }

    expect(await unsaveMyJob(externalSaveKey(grad))).toEqual([]);
    expect(await mySavedJobs()).toEqual([]);
  });
});
