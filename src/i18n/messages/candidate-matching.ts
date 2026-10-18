// Round 20 (ADR 0023): the wording src/lib/candidate-matching.ts builds for an employer's suggested candidates (the
// seven match factors, each with what the job asks and what the profile says) and the five facts a candidate card
// shows (CANDIDATE_FACT_LABELS, candidateFacts()). Line B owns it (导师 10-18 19:5x); line A's ApplyJob,
// CandidatePublicPage and ProfileWorkspace read the facts from here at step 2.
//
// Not here: the SKILLS and LANGUAGE_WORDS patterns and the negation words (they read what candidates and
// employers wrote), enum labels in i18n/labels.ts and config/job-roles.ts, area names (config/countries.ts), and
// what the candidate typed (availability, languages). Lists of names come in already joined with listJoiner.
import type { Dictionary } from "@/i18n/messages";

const candidateMatchingZh = {
  /** The joiner between names in a list (roles, skills, languages, areas). */
  listJoiner: "、",

  /** MatchFactor.label, by MatchFactor.key. */
  factors: {
    skills: "岗位",
    experience: "相关经验",
    languages: "沟通语言",
    type: "用工形式",
    region: "工作地区",
    hours: "每周工时",
    pay: "期望时薪",
  },

  /** The display names of SKILLS, keyed by the name the code uses. */
  skills: {
    前厅服务: "前厅服务",
    点餐: "点餐",
    上菜: "上菜",
    收银: "收银",
    备菜: "备菜",
    洗碗: "洗碗",
    厨房清洁: "厨房清洁",
    点心制作: "点心制作",
    理货: "理货",
    门店管理: "门店管理",
    美发: "美发",
    木工: "木工",
    "Site Safe": "Site Safe",
    清洁: "清洁",
    仓储: "仓储",
    叉车: "叉车",
    驾驶: "驾驶",
    行政: "行政",
    客服: "客服",
  },

  /** The 岗位 factor. `note` is skillNote(), or "" when no other skill matched. */
  role: {
    jobHasNoRoles: "职位未选岗位类别",
    wantedMissing: "想做的岗位待补充",
    skillNote: (skills: string) => `；技能：${skills}`,
    ticked: (roles: string, note: string) => `都选了${roles}${note}`,
    mentioned: (roles: string, note: string) => `资料提到${roles}${note}`,
    sameIndustry: (roles: string, industry: string, note: string) => `想做${roles}，同属${industry}${note}`,
    wants: (roles: string, note: string) => `想做${roles}${note}`,
  },

  experience: {
    notRequired: "未要求最低经验年数",
    required: (years: number) => `至少 ${years} 年相关经验`,
    missing: "经验年数待补充",
    onResume: (years: number) => `简历填写 ${years} 年相关经验`,
    unclear: "相关岗位经验需进一步确认",
  },

  languages: {
    notLimited: "未限制语言",
    missing: "语言资料待补充",
  },

  type: {
    missing: "求职意向待补充",
  },

  region: {
    missing: "可工作地区待补充",
  },

  /** The 每周工时 factor. `max` is the same as `min` when the job gives one number. */
  hours: {
    job: (min: number, max: number) => `每周 ${min}${max !== min ? `–${max}` : ""} 小时`,
    notFixed: "工时未固定",
    available: (min: number, max: number, shifts: string) => `可工作 ${min}–${max} 小时 / 周；${shifts}`,
    shiftsUnknown: "具体班次待确认",
    missing: "可工作工时待补充",
  },

  /**
   * The 期望时薪 factor. `max` is null when the job gives one number. The figures come formatted
   * (i18n/format.ts: 25, 23.50), so only the symbol and the wording are here.
   */
  pay: {
    job: (min: string, max: string | null) => `$${min}${max ? `–${max}` : ""} / 小时`,
    expected: (pay: string) => `期望最低 $${pay} / 小时`,
    missing: "期望时薪待补充",
  },

  /** candidateFacts(): the five facts on a candidate card, in CANDIDATE_FACT_LABELS order. */
  facts: {
    labels: {
      availability: "可上班时间",
      region: "地区",
      pay: "期望时薪",
      languages: "语言",
      experience: "经验",
    },
    /** Between the candidate's own availability text and their hours. */
    joiner: " · ",
    hours: (min: number, max: number) => `每周 ${min}–${max} 小时`,
    payFrom: (pay: string) => `$${pay} 起`,
    noExperience: "无经验",
    years: (years: number) => `${years} 年`,
    missing: "待补充",
  },
};

export const candidateMatchingMessages: Dictionary<typeof candidateMatchingZh> = {
  zh: candidateMatchingZh,
  en: {
    listJoiner: ", ",

    factors: {
      skills: "Role",
      experience: "Related experience",
      languages: "Languages",
      type: "Job type",
      region: "Area",
      hours: "Hours per week",
      pay: "Expected pay",
    },

    skills: {
      前厅服务: "Front of house",
      点餐: "Taking orders",
      上菜: "Serving",
      收银: "Cashier",
      备菜: "Food prep",
      洗碗: "Dishwashing",
      厨房清洁: "Kitchen hand",
      点心制作: "Dim sum",
      理货: "Shelf stocking",
      门店管理: "Store management",
      美发: "Hairdressing",
      木工: "Carpentry",
      "Site Safe": "Site Safe",
      清洁: "Cleaning",
      仓储: "Warehouse",
      叉车: "Forklift",
      驾驶: "Driving",
      行政: "Office admin",
      客服: "Customer service",
    },

    role: {
      jobHasNoRoles: "The job has no role picked",
      wantedMissing: "Roles they want: not given yet",
      skillNote: (skills) => `; skills: ${skills}`,
      ticked: (roles, note) => `Picked ${roles}${note}`,
      mentioned: (roles, note) => `Profile mentions ${roles}${note}`,
      sameIndustry: (roles, industry, note) => `Wants ${roles}, also in the same industry (${industry})${note}`,
      wants: (roles, note) => `Wants ${roles}${note}`,
    },

    experience: {
      notRequired: "No minimum years asked",
      required: (years) =>
        years === 1 ? "At least 1 year of related experience" : `At least ${years} years of related experience`,
      missing: "Years of experience: not given yet",
      onResume: (years) =>
        years === 1 ? "CV says 1 year of related experience" : `CV says ${years} years of related experience`,
      unclear: "Related experience needs checking",
    },

    languages: {
      notLimited: "Any language",
      missing: "Languages: not given yet",
    },

    type: {
      missing: "Job type wanted: not given yet",
    },

    region: {
      missing: "Areas they can work in: not given yet",
    },

    hours: {
      job: (min, max) => `${min}${max !== min ? `–${max}` : ""} hours a week`,
      notFixed: "Hours not fixed",
      available: (min, max, shifts) => `Can work ${min}–${max} hours a week; ${shifts}`,
      shiftsUnknown: "shifts to be confirmed",
      missing: "Hours they can work: not given yet",
    },

    pay: {
      job: (min, max) => `$${min}${max ? `–${max}` : ""} an hour`,
      expected: (pay) => `Expects at least $${pay} an hour`,
      missing: "Expected pay: not given yet",
    },

    facts: {
      labels: {
        availability: "Availability",
        region: "Area",
        pay: "Expected pay",
        languages: "Languages",
        experience: "Experience",
      },
      joiner: " · ",
      hours: (min, max) => `${min}–${max} hours a week`,
      payFrom: (pay) => `From $${pay} an hour`,
      noExperience: "No experience",
      years: (years) => (years === 1 ? "1 year" : `${years} years`),
      missing: "Not given yet",
    },
  },
};
