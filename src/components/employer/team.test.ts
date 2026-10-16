import { describe, expect, it } from "vitest";
import {
  checkTeamChange,
  checkTeamName,
  sortTeam,
  teamCan,
  teamSignature,
  type TeamMember,
} from "@/components/employer/team";

const admin: TeamMember = {
  email: "boss@example.com",
  role: "admin",
  name: "王老板",
  joinedAt: "2026-10-01T00:00:00Z",
};
const member: TeamMember = {
  email: "staff@example.com",
  role: "member",
  name: "小李",
  joinedAt: "2026-10-02T00:00:00Z",
};
const admin2: TeamMember = { email: "boss2@example.com", role: "admin", name: null, joinedAt: "2026-10-03T00:00:00Z" };

describe("team permissions (#87)", () => {
  it("lets members post and handle jobs, applicants and chats, but not 企业验证 or the team", () => {
    for (const p of ["post", "jobs", "applicants", "chat"] as const) {
      expect(teamCan("member", p)).toBe(true);
      expect(teamCan("admin", p)).toBe(true);
    }
    expect(teamCan("member", "verify")).toBe(false);
    expect(teamCan("member", "team")).toBe(false);
    expect(teamCan("admin", "verify")).toBe(true);
    expect(teamCan("admin", "team")).toBe(true);
    expect(teamCan(undefined, "post")).toBe(false);
  });
});

describe("team changes (#87)", () => {
  it("lets an admin promote, demote and remove others", () => {
    const team = [admin, member, admin2];
    expect(checkTeamChange(team, admin.email, { type: "role", email: member.email, role: "admin" })).toBeUndefined();
    expect(checkTeamChange(team, admin.email, { type: "role", email: admin2.email, role: "member" })).toBeUndefined();
    expect(checkTeamChange(team, admin.email, { type: "remove", email: member.email })).toBeUndefined();
  });

  it("never leaves a team without an admin", () => {
    const team = [admin, member];
    expect(checkTeamChange(team, admin.email, { type: "role", email: admin.email, role: "member" })).toBe("last_admin");
    expect(checkTeamChange(team, admin.email, { type: "remove", email: admin.email })).toBe("last_admin");
    expect(checkTeamChange(team, admin.email, { type: "leave" })).toBe("last_admin");
    // With a second admin, either may step down or leave.
    expect(checkTeamChange([...team, admin2], admin.email, { type: "leave" })).toBeUndefined();
    // Making an admin an admin again is not losing one.
    expect(checkTeamChange(team, admin.email, { type: "role", email: admin.email, role: "admin" })).toBeUndefined();
  });

  it("lets a member leave but not manage anyone", () => {
    const team = [admin, member];
    expect(checkTeamChange(team, member.email, { type: "leave" })).toBeUndefined();
    expect(checkTeamChange(team, member.email, { type: "remove", email: admin.email })).toBe("not_admin");
    expect(checkTeamChange(team, member.email, { type: "role", email: member.email, role: "admin" })).toBe("not_admin");
  });

  it("refuses people outside the team and targets who already left", () => {
    expect(checkTeamChange([admin], "someone@example.com", { type: "leave" })).toBe("not_member");
    expect(checkTeamChange([admin], admin.email, { type: "remove", email: member.email })).toBe("no_such_member");
  });
});

describe("team names (#87)", () => {
  it("trims, limits the length and keeps contact details out", () => {
    expect(checkTeamName("  王  经理 ")).toEqual({ ok: true, name: "王 经理" });
    expect(checkTeamName(" ").ok).toBe(false);
    expect(checkTeamName("一二三四五六七八九十一二三").ok).toBe(false);
    expect(checkTeamName("一二三四五六七八九十一二").ok).toBe(true);
    expect(checkTeamName("li@example.com").ok).toBe(false);
    expect(checkTeamName("王 021234567").ok).toBe(false);
  });

  it("signs chats with the shop and, when there is one, the person", () => {
    expect(teamSignature("川味小馆", "王经理")).toBe("川味小馆 · 王经理");
    expect(teamSignature("川味小馆", null)).toBe("川味小馆");
  });

  it("lists admins first, then by joining time", () => {
    expect(sortTeam([member, admin2, admin]).map((m) => m.email)).toEqual([admin.email, admin2.email, member.email]);
  });
});
