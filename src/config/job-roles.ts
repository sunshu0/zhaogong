// 岗位类别 (#96): what a job is, in the words employers and job seekers actually use. Matching compares these
// categories rather than keywords, so 服务员, 前台, 接待 and 跑堂 all count as 前厅服务. Add a role or a way of
// saying it here only; docs/job-roles.md lists them for people (a unit test keeps the two together).
import type { Industry } from "@/lib/types";

export const JOB_ROLE_IDS = [
  "front_of_house",
  "kitchen_hand",
  "cook",
  "dim_sum",
  "barista",
  "cashier",
  "shop_assistant",
  "store_manager",
  "warehouse",
  "driver",
  "cleaner",
  "hairdresser",
  "beauty",
  "carpenter",
  "painter",
  "labourer",
  "office",
  "customer_service",
] as const;
export type JobRoleId = (typeof JOB_ROLE_IDS)[number];

export type JobRole = {
  zh: string;
  en: string;
  /** The industries it is found in; a role found in the job's industry is the closer guess. */
  industries: Industry[];
  /** Ways of naming it, Chinese as written and English in lower case, matched as parts of a title. */
  aliases: string[];
};

/** At most this many per job: the second for a job that really is two (洗头按摩 → 美发 and 美容). */
export const MAX_JOB_ROLES = 2;

export const JOB_ROLES: Record<JobRoleId, JobRole> = {
  front_of_house: {
    zh: "前厅服务",
    en: "Front of house",
    industries: ["hospitality"],
    aliases: [
      "前厅",
      "服务员",
      "楼面",
      "前台",
      "接待",
      "跑堂",
      "传菜",
      "迎宾",
      "领位",
      "front of house",
      "front-of-house",
      "floor staff",
      "waitstaff",
      "waiter",
      "waitress",
      "receptionist",
    ],
  },
  kitchen_hand: {
    zh: "后厨帮工",
    en: "Kitchen hand",
    industries: ["hospitality"],
    aliases: [
      "厨房帮工",
      "帮厨",
      "后厨",
      "洗碗",
      "打荷",
      "备菜",
      "外卖打包",
      "kitchen hand",
      "kitchenhand",
      "dishwasher",
      "dish washer",
      "takeaway packer",
    ],
  },
  cook: {
    zh: "厨师",
    en: "Cook",
    industries: ["hospitality"],
    aliases: ["厨师", "炒锅", "主厨", "炉头", "砧板", "寿司", "烧腊", "chef", "cook"],
  },
  dim_sum: {
    zh: "点心面点",
    en: "Dim sum and pastry",
    industries: ["hospitality"],
    aliases: ["点心", "面点", "包点", "dim sum", "pastry"],
  },
  barista: {
    zh: "咖啡奶茶",
    en: "Barista and bubble tea",
    industries: ["hospitality"],
    aliases: ["咖啡", "奶茶", "饮品", "barista", "bubble tea"],
  },
  cashier: {
    zh: "收银",
    en: "Cashier",
    industries: ["retail", "hospitality"],
    aliases: ["收银", "cashier", "checkout"],
  },
  shop_assistant: {
    zh: "理货店员",
    en: "Shop assistant",
    industries: ["retail"],
    aliases: ["理货", "上货", "店员", "导购", "shelf", "stacker", "shop assistant", "retail assistant"],
  },
  store_manager: {
    zh: "门店管理",
    en: "Store manager",
    industries: ["retail", "hospitality"],
    aliases: ["店长", "店经理", "门店经理", "门店管理", "主管", "store manager", "shop manager", "supervisor"],
  },
  warehouse: {
    zh: "仓库拣货打包",
    en: "Warehouse picking and packing",
    industries: ["logistics"],
    aliases: ["仓库", "仓储", "拣货", "分拣", "包装", "打包", "picker", "packer", "warehouse"],
  },
  driver: {
    zh: "司机配送",
    en: "Driver and delivery",
    industries: ["driver", "logistics"],
    aliases: ["司机", "送货", "配送", "快递", "driver", "delivery", "courier"],
  },
  cleaner: {
    zh: "清洁",
    en: "Cleaner",
    industries: ["cleaning"],
    aliases: ["清洁", "保洁", "家政", "cleaner", "cleaning", "housekeeping"],
  },
  hairdresser: {
    zh: "美发",
    en: "Hairdresser",
    industries: ["beauty"],
    aliases: ["美发", "发型", "理发", "洗头", "hairdresser", "hairstylist", "barber", "salon"],
  },
  beauty: {
    zh: "美甲美容",
    en: "Nails and beauty",
    industries: ["beauty"],
    aliases: ["美甲", "美容", "美睫", "按摩", "nail", "beauty", "massage"],
  },
  carpenter: {
    zh: "木工",
    en: "Carpenter",
    industries: ["construction"],
    aliases: ["木工", "木匠", "carpenter", "joiner"],
  },
  painter: {
    zh: "油漆",
    en: "Painter",
    industries: ["construction"],
    aliases: ["油漆", "刷漆", "painter"],
  },
  labourer: {
    zh: "装修杂工",
    en: "Labourer",
    industries: ["construction"],
    aliases: ["杂工", "小工", "泥瓦", "瓷砖", "拆除", "labourer", "laborer", "tiler"],
  },
  office: {
    zh: "办公文员",
    en: "Office administrator",
    industries: ["office"],
    aliases: ["文员", "行政", "前台", "助理", "office", "admin", "receptionist"],
  },
  customer_service: {
    zh: "客服",
    en: "Customer service",
    industries: ["office", "retail"],
    aliases: ["客服", "customer service"],
  },
};
