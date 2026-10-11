import { describe, expect, it } from "vitest";
import { getMyJobs, parseDraft, publishJob } from "@/app/employer/actions";
import { getJob, listJobs } from "@/lib/data";

const MESSAGE = `Mt Eden 川菜馆招前厅服务员，时薪 $25-27，每周 15-25 小时，包工作餐，学签可做。微信 demo_chuanwei`;

describe("publishJob", () => {
  it("publishes a clean draft as active, visible to job seekers", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const result = await publishJob(draft, "e1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job).toMatchObject({ employerId: "e1", status: "active", titleZh: "前厅服务员" });
    expect((await listJobs({ country: "NZ" })).map((j) => j.id)).toContain(result.job.id);
    expect((await getMyJobs("e1"))[0].id).toBe(result.job.id);
  });

  it("sends a high-risk draft to review instead of the list", async () => {
    const { draft } = await parseDraft(`${MESSAGE}，KTV 包间`);
    const result = await publishJob(draft, "e1");
    expect(result.ok && result.job.status).toBe("pending_review");
  });

  it("re-checks on the server and refuses what the browser should have held back", async () => {
    const { draft } = await parseDraft(MESSAGE.replace("$25-27", "$20"));
    const result = await publishJob({ ...draft, descriptionZh: "入职交押金。" }, "e1");
    expect(result).toMatchObject({ ok: false, reason: "not_ready" });
    expect(!result.ok && result.findings.map((f) => f.rule)).toEqual(["min_wage", "fee"]);
  });

  it("refuses an incomplete draft and an unknown employer", async () => {
    expect(await publishJob({ titleZh: "洗碗工" }, "e1")).toMatchObject({ ok: false, reason: "not_ready" });
    const { draft } = await parseDraft(MESSAGE);
    expect(await publishJob(draft, "nobody")).toMatchObject({ ok: false, reason: "unknown_employer" });
  });

  it("ignores fields the browser should not set", async () => {
    const { draft } = await parseDraft(MESSAGE);
    const result = await publishJob({ ...draft, status: "active", employerId: "e2", id: "j1" }, "e1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job.employerId).toBe("e1");
    expect(result.job.id).not.toBe("j1");
    expect((await getJob("j1"))?.titleZh).toBe("前厅服务员"); // the demo job is untouched
  });
});
