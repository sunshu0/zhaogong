import { describe, expect, it } from "vitest";
import { EVENTS, FILTER_NAMES, checkEvent } from "@/lib/events/catalog";

describe("the funnel events' list (#312, ADR 0025 §4)", () => {
  it("has the 16 events of the ADR's table after removing applications (#352)", () => {
    expect(Object.keys(EVENTS)).toHaveLength(16);
    expect(FILTER_NAMES).toEqual(["q", "region", "industry", "role", "type", "minPay", "visa", "meals", "housing"]);
  });

  it("takes an event on the list, with its job and detail", () => {
    expect(checkEvent({ name: "home_view", path: "/" })).toEqual({ name: "home_view", path: "/" });
    expect(checkEvent({ name: "job_view", path: "/jobs/[id]", jobId: "j3" })).toEqual({
      name: "job_view",
      path: "/jobs/[id]",
      jobId: "j3",
    });
    expect(checkEvent({ name: "external_view", path: "/external/[id]", jobId: "demo-kowhai:4005" })?.jobId).toBe(
      "demo-kowhai:4005",
    );
    expect(checkEvent({ name: "post_publish", path: "/employer/post", jobId: "j9", detail: "pending_review" })).toEqual(
      { name: "post_publish", path: "/employer/post", jobId: "j9", detail: "pending_review" },
    );
    expect(checkEvent({ name: "chat_start", path: "/jobs/[id]", jobId: "j3", detail: "" })?.detail).toBeUndefined();
  });

  it("keeps a search's filter names only, once each, and never a value", () => {
    expect(checkEvent({ name: "jobs_search", path: "/jobs", detail: "q,region,q" })?.detail).toBe("q,region");
    expect(checkEvent({ name: "jobs_search", path: "/jobs", detail: "q=洗碗" })).toBeNull();
    expect(checkEvent({ name: "jobs_search", path: "/jobs", detail: "salary" })).toBeNull();
  });

  it("turns away anything off the list", () => {
    for (const input of [
      null,
      "job_view",
      { name: "page_view", path: "/" },
      { name: "apply_open", path: "/jobs/[id]", jobId: "j1" },
      { name: "apply_submit", path: "/jobs/[id]", jobId: "j1" },
      { name: "toString", path: "/" },
      { name: "home_view", path: "https://evil.example/" },
      { name: "home_view", path: "/jobs?q=phone" },
      { name: "home_view", path: "/", jobId: "j1" },
      { name: "job_view", path: "/jobs/[id]" },
      { name: "job_view", path: "/jobs/[id]", jobId: "a b" },
      { name: "home_view", path: "/", detail: "x" },
      { name: "post_mode", path: "/employer/post", detail: "email@example.com" },
    ])
      expect(checkEvent(input)).toBeNull();
  });
});
