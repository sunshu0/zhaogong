// Companies whose public job postings 找工 may show as external jobs (Round 18, #111, ADR 0014). Kept by hand.
// A company is imported only after a person has read the terms of its careers site and of the tracking system's
// public API, written down who checked and when, and found that they allow showing the postings elsewhere with a
// link back. Until then `terms` stays null and the importer skips the company (and takes down anything it had).
//
// On 2026-10-17 the user had 找工's mentor review the terms of seven candidates, each found by reading its board's
// public API once (software or electrical jobs in New Zealand); see ADR 0014, 补充. ClearPoint and MYOB allow it
// and are below. Rocket Lab, Pushpay, Propellerhead and KPMG New Zealand ask for written permission and Dawn
// Aerospace forbids it, so the user had those five taken off the list: add one back only with written permission
// and its `terms` filled in. A full import takes down the jobs of companies no longer on the list.
//
// A second round the same day (#138) looked at Ashby, which most New Zealand software companies use: Halter, Partly
// and Auror allow it (their terms limit only their products, as MYOB's do); Xero's terms of use forbid copying any of
// its content, so it is not listed.
import type { ExternalSource } from "@/lib/external-jobs/types";

export interface TermsCheck {
  /** Who read the terms (a person, by name or role). */
  checkedBy: string;
  /** The day they read them, YYYY-MM-DD. */
  checkedOn: string;
  /** Whether the terms allow showing the postings' facts on 找工 with a link to the original. */
  allowsDisplay: boolean;
  /** Which terms were read (links), and anything they ask for. */
  note: string;
}

export interface ExternalCompany {
  /** Stable id, part of each job's id. */
  id: string;
  /** The name shown in 「来自 XX 官网」. */
  name: string;
  source: ExternalSource;
  /** Greenhouse board token, Lever site name, or Ashby job board name. */
  board: string;
  /** The company's own careers page. */
  careersUrl: string;
  terms: TermsCheck | null;
}

/** What the Lever layer says, the same for every company on Lever (read 2026-10-17). */
const LEVER_TERMS =
  "Lever：https://github.com/lever/postings-api 写明已发布的职位公开可见，「may be scraped by third parties」；https://hire.lever.co/developer/usecases 写明招聘网站可以读客户的公开职位 feed；https://www.lever.co/legal/terms-of-service 约束的是 Lever 的客户，没有关于抓取或转载职位的条款；jobs.lever.co、api.lever.co 的 robots.txt 是 Allow: /、Crawl-delay: 1。";

/** What the Ashby layer says, the same for every company on Ashby (read 2026-10-17, #138). */
const ASHBY_TERMS =
  "Ashby：https://developers.ashbyhq.com/docs/public-job-posting-api 说公开接口给公司自己的招聘页用（「If you host your own careers page, you can use this data to populate it」），不要鉴权，没有禁止第三方读取；https://www.ashbyhq.com/resources/terms 是「Ashby Customer Terms of Service」，只约束付费客户；jobs.ashbyhq.com 的 robots.txt 只挡 /meeting/、/b/、/api/，api.ashbyhq.com 的 robots.txt 回 401（等于没有）。isListed 为 false 的职位只许直链，导入器跳过。";

/** The review of 2026-10-17: 找工's mentor read the terms for the user, who asked for it that day. */
const REVIEW_2026_10_17 = {
  checkedBy: "找工导师（Claude）代用户审核，用户 2026-10-17 授权",
  checkedOn: "2026-10-17",
};

export const EXTERNAL_COMPANIES: ExternalCompany[] = [
  {
    id: "clearpoint",
    name: "ClearPoint",
    source: "lever",
    board: "clearpoint",
    careersUrl: "https://jobs.lever.co/clearpoint",
    terms: {
      ...REVIEW_2026_10_17,
      allowsDisplay: true,
      note:
        "官网只有隐私政策（https://clearpoint.digital/privacy），没有使用条款，/terms、/terms-of-use 都是 404，没有关于复制、抓取、链接的限制；官网招聘页链到 jobs.lever.co/clearpoint。" +
        LEVER_TERMS,
    },
  },
  {
    id: "myob",
    name: "MYOB",
    source: "lever",
    board: "myob-2",
    careersUrl: "https://jobs.lever.co/myob-2",
    terms: {
      ...REVIEW_2026_10_17,
      allowsDisplay: true,
      note:
        "https://www.myob.com/nz/legal/website-terms-of-use 和 careers.myob.com 链到的 https://www.myob.com/au/legal-disclaimer 只限制软件的复制和再分发，没有关于网站内容转载、抓取、链接、商业使用的条款。" +
        LEVER_TERMS,
    },
  },
  {
    id: "halter",
    name: "Halter",
    source: "ashby",
    board: "halter",
    careersUrl: "https://jobs.ashbyhq.com/halter",
    terms: {
      ...REVIEW_2026_10_17,
      allowsDisplay: true,
      note:
        "官网 legal 只有 Privacy Policy、Terms of Service、Software Usage Policy（两份），没有网站使用条款，/terms、/terms-of-use、/legal/website-terms 都是 404。https://www.halterhq.com/legal/terms-of-service 是给养殖户的服务合同，不许复制的是「any Content made available through the Software Services」；https://www.halterhq.com/legal/software-usage-policy 不许机器人读取的也是「the Software Services or Content」，都只限定在产品上（按第一轮 MYOB 的先例不算限制）。" +
        ASHBY_TERMS,
    },
  },
  {
    id: "partly",
    name: "Partly",
    source: "ashby",
    board: "partly.com",
    careersUrl: "https://jobs.ashbyhq.com/partly.com",
    terms: {
      ...REVIEW_2026_10_17,
      allowsDisplay: true,
      note:
        "官网 https://www.partly.com/nz/legal 只有 terms、privacy、repair-terms，没有网站使用条款。https://www.partly.com/nz/legal/terms 是车辆配件服务的「End User Agreement」，不许抓取和机器人的是「the Services, or information featured in it」，只限定在产品上（按第一轮 MYOB 的先例不算限制）。" +
        ASHBY_TERMS,
    },
  },
  {
    id: "auror",
    name: "Auror",
    source: "ashby",
    board: "auror",
    careersUrl: "https://jobs.ashbyhq.com/auror",
    terms: {
      ...REVIEW_2026_10_17,
      allowsDisplay: true,
      note:
        "官网 https://www.auror.co 只有隐私政策；https://www.auror.co/terms-of-use 是 Auror 平台注册用户的条款（「you won't be able to use the Auror platform」），不许抓取、深链、复制的都是「on the Platform」，只限定在产品上（按第一轮 MYOB 的先例不算限制）。" +
        ASHBY_TERMS,
    },
  },
];

/** Imported only when a person checked the terms and they allow showing the postings. */
export function importAllowed(company: ExternalCompany): boolean {
  return company.terms?.allowsDisplay === true && /^\d{4}-\d{2}-\d{2}$/.test(company.terms.checkedOn);
}

/**
 * Where a company asks for its jobs to be removed (#113, shown under every external job page). Set TAKEDOWN_EMAIL on
 * the server before launch; until then the pages say the address is still to come.
 */
export function takedownEmail(): string | undefined {
  return process.env.TAKEDOWN_EMAIL?.trim() || undefined;
}
