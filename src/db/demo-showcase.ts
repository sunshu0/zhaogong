// What the demo data adds so the newer features show without making anything up by hand (#88): a job of 川味小馆
// closing in 2 days (将截止, 续期) and one closed 20 days ago (已截止, 重新发布); a job held for review at posting and
// two reports from job seekers (审核后台); a demo job seeker with saved jobs and a job alert that found a new job.
// Dates are counted from the moment the demo data is loaded, so they read the same whichever day it is.
import type { Job, Report } from "@/lib/types";
import type { SavedStage } from "@/components/seeker/saved-jobs";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** The demo job seeker: sign in with this address to see 收藏 and 职位提醒 already in use. */
export const DEMO_SEEKER = "seeker@example.com";

export interface Showcase {
  jobs: Job[];
  reports: Report[];
  savedJobs: { email: string; jobId: string; savedAt: string; stage: SavedStage | null; stageSetAt: string | null }[];
  alert: { id: string; email: string; name: string; country: "NZ"; query: string; paused: boolean; createdAt: string };
  alertHit: { email: string; jobId: string; alertName: string; createdAt: string };
}

/** The records, with dates counted from `now`. Ids follow the demo's own (j20…, r1…). */
export function demoShowcase(now: number): Showcase {
  const at = (ms: number) => new Date(now + ms).toISOString();
  const kitchen = { phone: "021 555 0101", wechat: "demo_chuanwei" };

  const closingSoon: Job = {
    id: "j20",
    country: "NZ",
    employerId: "e1",
    titleZh: "外卖打包员",
    titleEn: "Takeaway packer",
    industry: "hospitality",
    employmentType: ["casual"],
    regionId: "akl-mt-eden",
    pay: { min: 24, max: 26 },
    hoursPerWeek: { min: 10, max: 16 },
    shiftsZh: "周五至周日晚市，17:00–21:30",
    mealsIncluded: true,
    accommodationIncluded: false,
    visaAccepted: ["citizen_resident", "open_work", "student", "working_holiday"],
    languages: ["mandarin", "english"],
    descriptionZh: "晚市外卖单多，负责核对订单、打包、交给外卖骑手。学生可做，每周至少两晚。需要能看懂英文订单。",
    descriptionEn:
      "Checking takeaway orders, packing them and handing them to delivery riders on busy evenings. Students welcome, at least two evenings a week. Must read English orders.",
    contactPublic: false,
    contact: kitchen,
    status: "active",
    postedAt: at(-28 * DAY),
    expiresAt: at(2 * DAY),
    urgent: false,
  };

  const longClosed: Job = {
    ...closingSoon,
    id: "j21",
    titleZh: "洗碗工",
    titleEn: "Dishwasher",
    employmentType: ["part_time"],
    pay: { min: 23.5, max: 23.5 },
    hoursPerWeek: { min: 20, max: 25 },
    shiftsZh: "周三至周日晚班，17:00–22:00",
    visaAccepted: ["citizen_resident", "open_work", "student", "working_holiday"],
    languages: ["mandarin"],
    descriptionZh: "晚市洗碗、收拾厨房。不需要经验，会普通话即可。",
    descriptionEn: "Dishwashing and cleaning the kitchen in the evening. No experience needed; Mandarin is enough.",
    postedAt: at(-50 * DAY),
    expiresAt: at(-20 * DAY),
  };

  const newChef: Job = {
    ...closingSoon,
    id: "j22",
    titleZh: "炒锅师傅",
    titleEn: "Wok chef",
    employmentType: ["full_time"],
    pay: { min: 28, max: 32 },
    hoursPerWeek: { min: 40, max: 45 },
    shiftsZh: "每周五天，午市和晚市",
    visaAccepted: ["citizen_resident", "open_work", "working_holiday"],
    languages: ["mandarin"],
    descriptionZh: "负责川菜热菜出品，会做水煮鱼、回锅肉等家常川菜。有两年以上炒锅经验。包工作餐。",
    descriptionEn:
      "Cooking the Sichuan hot dishes, such as boiled fish and twice-cooked pork. Two years or more on the wok. Staff meals included.",
    contactPublic: true,
    postedAt: at(-26 * HOUR),
    expiresAt: at(-26 * HOUR + 30 * DAY),
  };

  // 按摩 is one of the words held for a person to look at (high_risk), so it waits in 发布时被标记.
  const heldForReview: Job = {
    id: "j23",
    country: "NZ",
    employerId: "e4",
    titleZh: "洗头按摩师",
    titleEn: "Shampoo and scalp massage assistant",
    industry: "beauty",
    employmentType: ["part_time"],
    regionId: "akl-newmarket",
    pay: { min: 25, max: 28 },
    hoursPerWeek: { min: 15, max: 25 },
    shiftsZh: "周四至周日",
    mealsIncluded: false,
    accommodationIncluded: false,
    visaAccepted: ["citizen_resident", "open_work", "working_holiday"],
    languages: ["mandarin", "english"],
    descriptionZh: "为客人洗头、做头部按摩，协助发型师。有美发店经验优先。",
    descriptionEn: "Washing hair and scalp massage for clients, helping the stylists. Salon experience preferred.",
    contactPublic: false,
    contact: { phone: "021 555 0104" },
    status: "pending_review",
    postedAt: at(-3 * HOUR),
    expiresAt: at(-3 * HOUR + 30 * DAY),
    urgent: false,
  };

  const alertName = "Mt Eden 餐饮";
  return {
    jobs: [closingSoon, longClosed, newChef, heldForReview],
    reports: [
      {
        id: "r1",
        jobId: "j11",
        reason: "charges_fee",
        note: "电话里说要先交 200 元介绍费才能安排上岗。",
        createdAt: at(-5 * HOUR),
        status: "open",
      },
      {
        id: "r2",
        jobId: "j13",
        reason: "below_min_wage",
        note: "面试时说试用期时薪 18 元，比职位上写的低。",
        createdAt: at(-30 * HOUR),
        status: "open",
      },
    ],
    savedJobs: [
      { email: DEMO_SEEKER, jobId: "j1", savedAt: at(-4 * DAY), stage: "contacted", stageSetAt: at(-3 * DAY) },
      { email: DEMO_SEEKER, jobId: "j3", savedAt: at(-2 * DAY), stage: null, stageSetAt: null },
    ],
    alert: {
      id: "demo-alert-1",
      email: DEMO_SEEKER,
      name: alertName,
      country: "NZ",
      query: "region=akl-mt-eden&industry=hospitality",
      paused: false,
      createdAt: at(-5 * DAY),
    },
    alertHit: { email: DEMO_SEEKER, jobId: newChef.id, alertName, createdAt: newChef.postedAt },
  };
}
