import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JOB_ROLE_IDS, JOB_ROLES } from "@/config/job-roles";
import { jobRoles, parseJobRoles, suggestJobRoles } from "@/lib/job-roles";
import { demoShowcase } from "@/db/demo-showcase";
import { MOCK_JOBS } from "@/mock/data";

describe("岗位类别 from a job title (#96)", () => {
  it("files 服务员, 前台, 接待 and 跑堂 under 前厅服务", () => {
    for (const titleZh of ["服务员", "前台", "前台接待", "接待员", "跑堂", "楼面服务员"])
      expect(suggestJobRoles({ titleZh, industry: "hospitality" }), titleZh).toEqual(["front_of_house"]);
    expect(suggestJobRoles({ titleEn: "Waitress", industry: "hospitality" })).toEqual(["front_of_house"]);
  });

  it("reads a word in the job's industry only", () => {
    expect(suggestJobRoles({ titleZh: "前台", industry: "office" })).toEqual(["office"]);
    expect(suggestJobRoles({ titleZh: "奶茶店店员", industry: "hospitality" })).toEqual(["barista"]);
    expect(suggestJobRoles({ titleZh: "超市店员", industry: "retail" })).toEqual(["shop_assistant"]);
    expect(suggestJobRoles({ titleZh: "发型助理", industry: "beauty" })).toEqual(["hairdresser"]);
    // 其他, or no industry yet (a draft), takes any role.
    expect(suggestJobRoles({ titleZh: "司机", industry: "other" })).toEqual(["driver"]);
    expect(suggestJobRoles({ titleZh: "收银员" })).toEqual(["cashier"]);
  });

  it("gives at most two, and none when the title names no role (待选)", () => {
    expect(suggestJobRoles({ titleZh: "洗头按摩师", industry: "beauty" })).toEqual(["hairdresser", "beauty"]);
    expect(suggestJobRoles({ titleZh: "店长兼收银", industry: "retail" })).toEqual(["cashier", "store_manager"]);
    expect(suggestJobRoles({ titleZh: "兼职", titleEn: "Part time", industry: "hospitality" })).toEqual([]);
  });

  it("files every demo job", () => {
    for (const job of [...MOCK_JOBS, ...demoShowcase(Date.now()).jobs])
      expect(suggestJobRoles(job).length, job.titleZh).toBeGreaterThan(0);
  });

  it("keeps the employer's choice over the title, and reads only known ids", () => {
    const job = { ...MOCK_JOBS[0], roles: ["cashier" as const] };
    expect(jobRoles(job)).toEqual(["cashier"]);
    expect(jobRoles({ ...job, roles: [] })).toEqual(["front_of_house"]);
    expect(parseJobRoles(["cook", "cook", "nope", 3, "dim_sum", "barista"])).toEqual(["cook", "dim_sum"]);
    expect(parseJobRoles("cook")).toEqual([]);
  });

  it("docs/job-roles.md lists every category and each way of naming it", () => {
    const doc = readFileSync(path.join(process.cwd(), "docs", "job-roles.md"), "utf8");
    for (const id of JOB_ROLE_IDS) {
      const row = doc.split("\n").find((line) => line.includes(`\`${id}\``));
      expect(row, id).toBeDefined();
      expect(row).toContain(JOB_ROLES[id].zh);
      for (const alias of JOB_ROLES[id].aliases) expect(row, `${id}: ${alias}`).toContain(alias);
    }
  });
});
