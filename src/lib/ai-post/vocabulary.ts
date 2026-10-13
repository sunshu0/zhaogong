// Words the parser stub recognises. A real model replaces the parser, not this vocabulary's users,
// so keep the lists plain data that is easy to extend.
import type { Industry, LanguageRequirement, VisaAccepted } from "@/lib/types";

export interface TitleEntry {
  zh: string;
  en: string;
  /** English ways of writing the same job, lower case. */
  enAliases?: string[];
  /** Left out when the title alone does not say (店员 can be retail or a bubble tea shop). */
  industry?: Industry;
}

/** Longer entries first: 前厅服务员 wins over 服务员. */
export const TITLES: TitleEntry[] = [
  {
    zh: "前厅服务员",
    en: "Front-of-house staff",
    enAliases: ["front of house", "front-of-house"],
    industry: "hospitality",
  },
  { zh: "楼面服务员", en: "Floor staff", enAliases: ["floor staff"], industry: "hospitality" },
  { zh: "厨房帮工", en: "Kitchen hand", enAliases: ["kitchen hand", "kitchenhand"], industry: "hospitality" },
  { zh: "点心师傅", en: "Dim sum chef", enAliases: ["dim sum chef"], industry: "hospitality" },
  { zh: "寿司师傅", en: "Sushi chef", enAliases: ["sushi chef"], industry: "hospitality" },
  { zh: "送货司机", en: "Delivery driver", enAliases: ["delivery driver"], industry: "driver" },
  { zh: "发型助理", en: "Salon assistant", enAliases: ["salon assistant"], industry: "beauty" },
  { zh: "服务员", en: "Waitstaff", enAliases: ["waiter", "waitress", "waitstaff"], industry: "hospitality" },
  { zh: "洗碗工", en: "Dishwasher", enAliases: ["dishwasher", "dish washer"], industry: "hospitality" },
  { zh: "帮厨", en: "Kitchen hand", industry: "hospitality" },
  { zh: "厨师", en: "Chef", enAliases: ["chef", "cook"], industry: "hospitality" },
  { zh: "咖啡师", en: "Barista", enAliases: ["barista"], industry: "hospitality" },
  { zh: "收银员", en: "Cashier", enAliases: ["cashier"], industry: "retail" },
  { zh: "理货员", en: "Shelf stacker", enAliases: ["shelf stacker"], industry: "retail" },
  { zh: "拣货员", en: "Warehouse picker", enAliases: ["picker", "packer"], industry: "logistics" },
  { zh: "仓库工", en: "Warehouse worker", enAliases: ["warehouse worker", "warehouse hand"], industry: "logistics" },
  { zh: "木工", en: "Carpenter", enAliases: ["carpenter", "builder"], industry: "construction" },
  { zh: "油漆工", en: "Painter", enAliases: ["painter"], industry: "construction" },
  { zh: "清洁工", en: "Cleaner", enAliases: ["cleaner"], industry: "cleaning" },
  { zh: "保洁", en: "Cleaner", industry: "cleaning" },
  { zh: "发型师", en: "Hairstylist", enAliases: ["hairstylist", "hairdresser"], industry: "beauty" },
  { zh: "美甲师", en: "Nail technician", enAliases: ["nail technician"], industry: "beauty" },
  { zh: "司机", en: "Driver", enAliases: ["driver"], industry: "driver" },
  { zh: "文员", en: "Office administrator", enAliases: ["office administrator", "office admin"], industry: "office" },
  { zh: "店长", en: "Store manager", enAliases: ["store manager", "shop manager"] },
  { zh: "店员", en: "Shop assistant", enAliases: ["shop assistant", "retail assistant"] },
  { zh: "前台", en: "Receptionist", enAliases: ["receptionist"] },
];

/** Checked in this order when the title does not settle the industry. */
export const INDUSTRY_WORDS: [Industry, string[]][] = [
  [
    "hospitality",
    [
      "餐厅",
      "饭店",
      "餐馆",
      "酒家",
      "酒楼",
      "火锅",
      "奶茶",
      "咖啡",
      "川菜",
      "粤菜",
      "早茶",
      "点心",
      "寿司",
      "烧烤",
      "面馆",
      "厨房",
      "restaurant",
      "cafe",
      "kitchen",
    ],
  ],
  ["retail", ["超市", "商店", "零售", "便利店", "supermarket", "shop", "store"]],
  ["beauty", ["美容", "美发", "发廊", "美甲", "salon"]],
  ["construction", ["装修", "工地", "建筑", "renovation", "construction"]],
  ["cleaning", ["清洁", "家政", "保洁", "cleaning"]],
  ["logistics", ["物流", "仓库", "warehouse"]],
  ["driver", ["司机", "送货", "delivery"]],
  ["office", ["办公室", "行政", "office"]],
];

/** Extra names for regions on top of the names in the country config, lower case. */
export const REGION_ALIASES: Record<string, string[]> = {
  "akl-cbd": ["city", "queen st", "皇后街"],
  "akl-mt-eden": ["dominion", "伊甸"],
  "akl-henderson": ["henderson"],
  "akl-manukau": ["manukau"],
};

export const VISA_WORDS: [VisaAccepted, string[]][] = [
  ["citizen_resident", ["公民", "永居", "绿卡", "居民", "pr", "resident", "citizen"]],
  ["open_work", ["开放工签", "开放式工签", "open work"]],
  ["aewv", ["aewv", "雇主担保"]],
  ["student", ["学签", "学生签", "student visa"]],
  ["working_holiday", ["打工度假", "度假签", "working holiday", "whv"]],
];

export const LANGUAGE_WORDS: [LanguageRequirement, string[]][] = [
  ["mandarin", ["普通话", "国语", "中文", "mandarin"]],
  ["cantonese", ["粤语", "广东话", "白话", "cantonese"]],
  ["english", ["英语", "英文", "english"]],
];
