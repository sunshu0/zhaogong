// The English side of legal-terms.ts (#240, #323): the browser loads it on English pages only.
// Typed by the Chinese side: a missing key, an extra key or a different shape fails tsc.

import type { Messages } from "@/i18n/messages";
import type { legalTermsMessages } from "@/i18n/messages/legal-terms";

export const legalTermsEn: Messages<(typeof legalTermsMessages)["zh"]> = {
  title: "Terms of use",
  description:
    "The rules for using this site: what it is and isn't, the laws job ads must follow, what is not allowed, reporting, accounts and liability.",
  updated: "Last updated: 20 October 2026",
  placeholders:
    "Text in square brackets (such as [Company name]) is not decided yet and will be filled in before launch.",
  tocLabel: "Contents",
  sections: [
    {
      id: "about",
      heading: "1. About these terms",
      body: [
        'This site is run by [Company name] ([Company address]). "We" below means the operator, and "you" means anyone using the site, job seekers and employers alike.',
        "By using the site you agree to these terms and to the privacy page. If you don't agree, please don't use the site.",
      ],
    },
    {
      id: "what",
      heading: "2. What this site is, and what it isn't",
      body: [
        "This site lets employers post jobs, and job seekers find work and contact employers. It is free for job seekers.",
        {
          list: [
            "We are not an employer or a recruitment agency: any employment is between the employer and the job seeker, who agree the pay, hours, contract and conditions between them.",
            "We do not negotiate for either side, and we do not promise that a job will be filled or that a job seeker will be hired.",
            'We check jobs automatically before they are posted and deal with reports, but we cannot verify every job or everything anyone says. "Verified business" only means we checked the business register entry and the contact person; it is not a guarantee of the business.',
            "We do not give visa or immigration advice. Visa details on jobs and profiles are what each side says about themselves; for questions, see Immigration New Zealand's official information or a licensed immigration adviser.",
          ],
        },
      ],
    },
    {
      id: "account",
      heading: "3. Your account",
      body: [
        {
          list: [
            "You must be 16 or older to use this site.",
            "You sign in with your email and a one-time code. Keep your email secure and don't share your codes. One account is for one person.",
            "When you use the employer role, you must work for that business or be authorised by it. What each team member can do follows their role on the team page.",
            "Keep what you enter true, and update it when it changes.",
            "You can delete your account at any time under Me › Data and account; the privacy page says what happens then.",
          ],
        },
      ],
    },
    {
      id: "employers",
      heading: "4. Job ads must follow the law",
      body: [
        "Employers are responsible for the jobs they post, and must make sure each job meets New Zealand law before posting it, including:",
        {
          list: [
            "Minimum wage: pay must not be below New Zealand's current legal minimum wage (Minimum Wage Act 1983). The minimum wage changes every year; see the rates published by Employment New Zealand.",
            "No discrimination: you must not refuse to employ someone, or offer worse terms, because of their sex, marital status, religious or ethical belief, colour, race, ethnic or national origins (including nationality or citizenship), disability, age, political opinion, employment status, family status or sexual orientation, and you must not publish an ad that shows such an intention (Human Rights Act 1993, sections 21, 22, 23 and 67). A language requirement must be genuinely needed for the job, with good reason (section 65).",
            "No charges: you must not ask a job seeker for a placement fee, deposit, introduction fee or any other premium for a job (Wages Protection Act 1983, section 12A).",
            "Immigration: only let people work who are entitled to do that work in New Zealand; do not employ people who are not entitled to work, and do not exploit temporary visa workers (Immigration Act 2009, sections 350 and 351). Do not promise visas or sponsorship you cannot give.",
            "True and accurate: the job, pay, hours, place and conditions must be true and not mislead job seekers (Fair Trading Act 1986, sections 9 and 13).",
            "Contact details: the contact details on a job must be for hiring only, and are shown to signed-in job seekers or exchanged in chat, as you choose.",
          ],
        },
        {
          links: [
            {
              label: "Current minimum wage (employment.govt.nz)",
              href: "https://www.employment.govt.nz/pay-and-hours/pay-and-wages/minimum-wage/minimum-wage-rates-and-types",
            },
          ],
        },
        "Our automatic checks only help: if they find nothing, that does not mean a job is lawful.",
      ],
    },
    {
      id: "forbidden",
      heading: "5. What is not allowed",
      body: [
        {
          list: [
            "False or misleading jobs, or ads that are not really for a job (such as sales, franchises, pyramid schemes or loans).",
            "Charging job seekers, or asking them to pay a deposit, buy something or pay for training first.",
            "Discrimination, harassment, threats, hate speech, or content that invades someone's privacy.",
            "Unlawful work: pay below the minimum wage, work by people not entitled to do it, sexual services and other unlawful work.",
            "Pretending to be another person or business.",
            "Using other people's contact details, CVs or chats outside this site, or sending spam to job seekers or employers.",
            "Scraping the site with programs, or interfering with how it runs.",
          ],
        },
      ],
    },
    {
      id: "report",
      heading: "6. Reporting and taking things down",
      body: [
        'Every job page has a "Report this job" button, and you don\'t need to sign in to use it. For problems in chats, or anything else you want us to deal with, write to [Contact email].',
        "Moderators deal with reports. We may take down content that breaks these terms or the law; for serious or repeated breaches we may suspend the account or ban the business. We will tell you why, and you can write to us to ask for a review.",
        "Complaints about harmful content online are handled under section 24 of New Zealand's Harmful Digital Communications Act 2015: within 48 hours of a valid complaint we tell the person who posted it, who has 48 hours to respond, and we then keep or remove it as the law sets out. You can also contact Netsafe, the agency appointed under that Act.",
        { links: [{ label: "Netsafe (netsafe.org.nz)", href: "https://netsafe.org.nz/" }] },
      ],
    },
    {
      id: "content",
      heading: "7. What you post",
      body: [
        "The jobs, profiles and messages you post stay yours. You let us show, store and process them to run the site, for example listing your job or passing your application to an employer. Once you delete content or your account we stop showing it (except for what the privacy page says is kept).",
        "You must have the right to post what you post.",
      ],
    },
    {
      id: "service",
      heading: "8. Changes to the service and interruptions",
      body: [
        "We try to keep the site running, but it may be unavailable at times for maintenance, faults or other reasons. We may improve or change features; if we are going to stop a main service you use, we will tell you on the site first.",
      ],
    },
    {
      id: "liability",
      heading: "9. Responsibility",
      body: [
        "Whoever posts a job or profile is responsible for it. Employers and job seekers are responsible for any employment between them, its pay and its conditions.",
        "As far as the law allows, we are not responsible for agreements between users, for what users post, or for other websites (such as the company sites external jobs link to).",
        "Nothing in these terms excludes, limits or changes any right you have under the Consumer Guarantees Act 1993 or the Fair Trading Act 1986 that the law does not allow to be excluded.",
      ],
    },
    {
      id: "changes",
      heading: "10. Changes to these terms",
      body: [
        "We may change these terms. We update the date at the top when we do, and we tell you on the site before an important change that is not in your favour takes effect. If you don't agree, you can delete your account before it does.",
      ],
    },
    {
      id: "law",
      heading: "11. Governing law",
      body: [
        "These terms are governed by New Zealand law. Disputes about these terms or the use of this site are dealt with by the courts of New Zealand or the Disputes Tribunal.",
        "New Zealand's mandatory rules protecting consumers, workers and job seekers apply to users in New Zealand.",
        {
          links: [
            { label: "Disputes Tribunal (disputestribunal.govt.nz)", href: "https://www.disputestribunal.govt.nz/" },
          ],
        },
      ],
    },
    {
      id: "contact",
      heading: "12. Contact us",
      body: ["[Company name], [Company address], [Contact email]."],
    },
  ],
};
