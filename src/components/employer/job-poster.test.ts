import { describe, expect, it } from "vitest";
import { posterLabel } from "@/components/employer/job-poster";

describe("posterLabel (#182)", () => {
  it("names the teammate who posted, and says when it was you only in a team", () => {
    expect(posterLabel({ kind: "teammate", name: "小李" }, 2)).toBe("小李发布");
    expect(posterLabel({ kind: "you" }, 3)).toBe("你发布的");
    expect(posterLabel({ kind: "you" }, 1)).toBeNull();
  });

  it("says when the poster left the team or deleted the account", () => {
    expect(posterLabel({ kind: "left", email: "lee@example.com" }, 1)).toBe("lee@example.com发布（已离开团队）");
    expect(posterLabel({ kind: "deleted" }, 2)).toBe("已删除的账号发布");
  });

  it("says nothing for a job from before posters were recorded", () => {
    expect(posterLabel(undefined, 4)).toBeNull();
  });
});
