import { describe, expect, it } from "vitest";
import {
  ALERT_NAME_MAX,
  alertConditions,
  alertFilter,
  alertNotificationId,
  cleanAlertName,
  defaultAlertName,
  normalizeAlertQuery,
} from "@/components/seeker/job-alerts";
import { notificationHref, notificationsFor, type Notification } from "@/components/seeker/hub-state";

describe("job alerts (#53)", () => {
  it("stores a query in one form, so the same search is the same alert", () => {
    expect(normalizeAlertQuery("q=服务员&industry=hospitality", "NZ")).toBe(
      normalizeAlertQuery("industry=hospitality&q=服务员", "NZ"),
    );
    expect(normalizeAlertQuery("industry=hospitality,nonsense&colour=red", "NZ")).toBe("industry=hospitality");
    expect(normalizeAlertQuery(undefined, "NZ")).toBe("");
    expect(normalizeAlertQuery(42, "NZ")).toBe("");
    expect(normalizeAlertQuery("sort=recommended&industry=hospitality&q=服务员", "NZ")).toBe(
      normalizeAlertQuery("industry=hospitality&q=服务员", "NZ"),
    );
    expect(normalizeAlertQuery("sort=recommended", "NZ")).toBe("");
  });

  it("reads back the filter of the job list", () => {
    expect(alertFilter({ country: "NZ", query: "industry=hospitality&meals=1&q=洗碗" })).toEqual({
      country: "NZ",
      industries: ["hospitality"],
      mealsIncluded: true,
      query: "洗碗",
    });
    expect(alertFilter({ country: "NZ", query: "" })).toEqual({ country: "NZ" });
  });

  it("keeps 岗位类别 and names the alert after it (#96)", () => {
    const alert = { country: "NZ" as const, query: "role=front_of_house&industry=hospitality" };
    expect(alertFilter(alert).roles).toEqual(["front_of_house"]);
    expect(defaultAlertName(alert)).toBe("餐饮、前厅服务");
    expect(normalizeAlertQuery("role=cleaner,astronaut", "NZ")).toBe("role=cleaner");
  });

  it("names an alert after its conditions, shortened to fit", () => {
    const alert = { country: "NZ" as const, query: "industry=hospitality&meals=1" };
    expect(alertConditions(alert)).toEqual(["餐饮", "包餐"]);
    expect(defaultAlertName(alert)).toBe("餐饮、包餐");
    expect(defaultAlertName({ country: "NZ", query: "" })).toBe("全部新职位");
    expect(defaultAlertName({ country: "NZ", query: "q=洗碗&meals=1" })).toBe("包餐、洗碗");
    const long = defaultAlertName({ country: "NZ", query: `q=${"厨".repeat(40)}&meals=1` });
    expect(long).toHaveLength(ALERT_NAME_MAX);
    expect(long.endsWith("…")).toBe(true);
  });

  it("keeps a typed name to one short line", () => {
    expect(cleanAlertName("  北岸   早茶 \n 兼职 ")).toBe("北岸 早茶 兼职");
    expect(cleanAlertName("长".repeat(30))).toHaveLength(ALERT_NAME_MAX);
    expect(cleanAlertName("   ")).toBeUndefined();
    expect(cleanAlertName(null)).toBeUndefined();
  });

  it("gives each job one notification id", () => {
    expect(alertNotificationId("j21")).toBe("alert:j21");
  });
});

describe("notifications from job alerts (#53)", () => {
  const seeker = { email: "a@example.com", signedInAt: "", activeRole: "seeker" as const };
  const found: Notification = {
    id: alertNotificationId("j30"),
    type: "提醒",
    title: "有新职位符合提醒「餐饮」",
    detail: "川味小馆正在招聘前厅服务员",
    time: "今天",
    unread: true,
    target: { type: "job", id: "j30" },
  };

  it("come first, read like the others, and open the job", () => {
    const items = notificationsFor(seeker, [found.id], [found]);
    expect(items[0]).toEqual({ ...found, unread: false });
    expect(items.slice(1)).toEqual(notificationsFor(seeker, []));
    expect(notificationHref(found, seeker)).toBe("/jobs/j30");
  });
});
