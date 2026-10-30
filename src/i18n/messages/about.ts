// /about (#324): who runs 找工, who it is for, what it costs, the rules every job keeps and how to reach us. Every
// statement is checked against New Zealand law (the PR lists the sections); who runs it and how to reach them are
// the user's wording of 10-30 (a personal, non-commercial project), the same as on the privacy page (#323).
import type { Dictionary } from "@/i18n/messages";

const aboutZh = {
  title: "关于找工",
  intro:
    "找工是给在新西兰的华人用的中文招聘信息平台，先从奥克兰开始：餐饮、零售、清洁、美容美发、装修建筑、物流仓储等行业的职位，以及从公司官网导入的实习和专业职位。",
  who: {
    heading: "谁在做",
    body: "找工是一个个人学习项目（非商业），由项目维护者在新西兰奥克兰运营。找工只发布招聘信息，不是雇主，不是职业中介，也不是移民顾问：雇佣关系在你和雇主之间。",
  },
  cost: {
    heading: "收不收费",
    body: "求职者使用找工不收任何费用：看职位、聊天、收藏和提醒都免费。雇主现在发布职位也不收费。",
  },
  rules: {
    heading: "每个职位都要守的规矩",
    intro: "发布前系统会自动检查，审核员也会处理大家的举报；不守规矩的职位会被拦下或下架。",
    /** The adult minimum wage and the day it took effect, from the country's settings. */
    wage: (wage: string, since: string) => `时薪不低于法定最低工资：现在成人每小时 ${wage}（${since}起）。`,
    noFees: "不向求职者收取任何费用、押金或保证金；这样的职位会被拦下或下架。",
    noDiscrimination: "不按种族、肤色、族裔、国籍或民族出身挑人。工作确实需要的语言要求可以写，比如「需要会说粤语」。",
    report: "看到不守规矩的职位，请在职位页按「举报这个职位」。",
  },
  visa: {
    heading: "签证和移民",
    body: "找工不提供签证或移民建议。职位上的签证信息只照录雇主或官网原文写的内容，不是建议。需要建议，请看新西兰移民局的官网，或找持牌移民顾问。",
    inz: "新西兰移民局（Immigration New Zealand）",
    advisers: "谁可以提供移民建议（新西兰移民顾问管理局 Immigration Advisers Authority）",
  },
  external: {
    heading: "实习和专业职位从哪来",
    body: "这两类职位从公司招聘系统公开的接口导入。我们只整理事实，不转载原文，并写明来源和取到的日期；申请在公司官网进行，找工看不到也不经手。公司要求删除时，我们当天下架。",
  },
  data: {
    heading: "你的资料",
    body: "我们怎样收集和使用你的资料，写在隐私说明里。你可以在「我的 → 数据与账号」下载或删除自己的数据。隐私官：项目维护者，邮箱：hello@zhaogongnz.com。",
    privacy: "隐私说明",
  },
  contact: {
    heading: "联系我们",
    body: "邮箱：hello@zhaogongnz.com。职位的问题请先在职位页按「举报这个职位」，这样处理得最快。",
  },
  // The footer's links to the three pages (the layout), named as each page is titled (#323 has the other two).
  footer: {
    label: "关于和法律信息",
    about: "关于找工",
    /** S2 (#390): /safety. */
    safety: "防骗指南",
    privacy: "隐私说明",
    terms: "使用条款",
    // #376: the desktop footer's columns.
    tagline: "奥克兰的中文工作，时薪写在最前面。",
    seekers: "求职者",
    employers: "雇主",
    legal: "法律",
  },
};

export const aboutMessages: Dictionary<typeof aboutZh> = { key: "about", zh: aboutZh };
