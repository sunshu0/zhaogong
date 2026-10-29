// The English side of legal-privacy.ts (#240, #323): the browser loads it on English pages only.
// Typed by the Chinese side: a missing key, an extra key or a different shape fails tsc.

import type { Messages } from "@/i18n/messages";
import type { legalPrivacyMessages } from "@/i18n/messages/legal-privacy";

export const legalPrivacyEn: Messages<(typeof legalPrivacyMessages)["zh"]> = {
  title: "Privacy",
  description:
    "What personal information we collect, why, who sees it, how long we keep it, and how you can see, correct and delete it.",
  updated: "Last updated: 30 October 2026",
  placeholders:
    "Text in square brackets (such as [Company name]) is not decided yet and will be filled in before launch.",
  tocLabel: "Contents",
  sections: [
    {
      id: "who",
      heading: "1. Who collects your information",
      body: [
        'This site is run by [Company name] ([Company address]), a company registered in China. "We" below means that company.',
        "We do business in New Zealand and serve people in New Zealand, so we follow New Zealand's Privacy Act 2020. Under section 4 of that Act it applies even if the company or the information is outside New Zealand.",
        "Our staff in China access the site's data (section 6). That is handling personal information within China, so we also follow China's Personal Information Protection Law (Article 3). Section 11 says what rights that law gives you and how to use them.",
        "Our privacy officer is [Privacy officer's name or role], at [Privacy contact email]. Contact the privacy officer to see, copy, correct or delete your information, to withdraw consent, or to complain; under the Personal Information Protection Law this is also the personal information handler's contact.",
      ],
    },
    {
      id: "collect",
      heading: "2. What we collect",
      body: [
        "We only collect what we need to run the service:",
        {
          list: [
            "Your account: the email you sign in with, when you signed up, your interface language, and whether you are using the job seeker or the employer role; the chat quick replies and opening message you changed (nothing is kept while you use the defaults). You sign in with a one-time code; there is no password.",
            "Your job seeker profile and CV: the name, summary, area, languages, availability, work history and skills, photo and work rights (such as your visa, as you describe it) that you fill in. Your private contact details (phone, WeChat, email) only go to someone when you choose to exchange them, or when you tick them on a CV you send in a chat.",
            "Applications: your note, a copy of your profile as it was when you applied, and any interview times and replies.",
            "Employers and jobs: the business's name, New Zealand Business Number (NZBN), area, business page, the jobs and the contact details on them. Team members' display names, roles and when they joined. Shop photos the business uploads (up to 6) and the benefits it ticks: we remove extra data such as where a photo was taken when it is uploaded, and a photo is public only once a moderator has approved it.",
            "Business verification: the contact person's name and role, the business's phone and website.",
            "Chats: the messages you and the other person send, and records of contact details or profiles exchanged; any CV you send to a business in a chat (kept as it was when you sent it, with the contact details you ticked). When a business's chat message mentions things like deposits, placement fees, selling visas or charging for sponsorship, order brushing or hiring by race, we record which business, which kind, which message and when (not another copy of the message); when one business has 3 or more within 7 days, a moderator looks at those messages. Messages job seekers send are not recorded. Conversations between a business's team and Zhaogong moderators (at most one per business, words only): the messages both sides send, when, and the account that sent each; on the business's side we also record the sender's name in the team at the time.",
            "Saved jobs, job alerts and their filters.",
            "Reports: the reason and anything you write. For a report with only a reason and a note, we do not record your account or email itself. To stop duplicate and mass reports, an open report carries a number worked out from your account or anonymous visitor number that cannot be turned back into either, deleted once the report is handled; it is also used to tell you, on the device that sent the report, whether it is still being handled. Each day's reports are counted under such numbers too (including one worked out from your network address; the address itself is not stored); a count lapses within 24 hours, and lapsed counts are deleted when someone later asks for or checks a sign-in code, or sends a report. When you report a job while signed in, you can also attach evidence: messages you pick from your own chats with that business (up to 20, kept as they read when you report) and screenshots (up to 3, with location and other metadata removed before they are stored). Evidence is stored with your account, only so that it is deleted with your account and shown to you in your export; moderators are not shown who sent it.",
            "Activity: when a signed-in job seeker views the public contact details on a job, the account and time (employers only see a count); chats started; job views (only a hash of a browser identifier); when a business's team last used the site (recorded for the business, not for who in the team).",
            "AI posting use: when an employer posts by chatting, the account, time and amount of use. The conversation itself is not stored there.",
            "Browser message push: only after you turn it on do we save this browser's push endpoint, encryption public key and authentication value, linked to your account, current sign-in session, seeker or employer identity at setup, interface language, and setup and update times. To limit repeated submissions, we also record the most recent setup attempt in that session, including an unsuccessful attempt; each session can keep at most 10 subscriptions. This is only for new chat alerts, not advertising or recommendations.",
            "Sign-in code counts: to stop anyone flooding the sign-in codes, we count the codes asked for and checked by your network address (IP) and by your email. We store only a hash made with a key on our server, which cannot be turned back into the address or the email; never the address or the email itself.",
            "Anonymous analytics events, see section 8.",
          ],
        },
        "We never ask for or store race, ethnicity or nationality, we do not collect passwords, and the site itself does not store your IP address.",
      ],
    },
    {
      id: "how",
      heading: "3. Where the information comes from",
      body: [
        "Mostly from you. Also: an employer enters your email when inviting you to their team; the people you chat with send you messages and contact details; your browser sends cookies (section 7).",
        "When we collect information, or as soon as we can afterwards, this page tells you the things above (information privacy principles 3 and 3A of the Privacy Act 2020). If you don't give some information, the feature that needs it may not work: without an email, for example, you cannot sign in.",
      ],
    },
    {
      id: "use",
      heading: "4. What we use it for",
      body: [
        {
          list: [
            "Signing you in, and keeping your job seeker and employer roles apart.",
            "Posting, showing and managing jobs; passing applications to employers; letting both sides chat and exchange contact details.",
            "Telling you about new jobs that match your alerts, and about applications, interviews, team invitations and business verification.",
            "When you choose Recommended, we use the job categories, regions and minimum hourly pay you have saved as your preferences to rank the current filtered job results. This does not make those preferences public to employers. You can switch back to Latest at any time.",
            "Checking jobs against the law before they are posted (such as the minimum wage and discriminatory wording), dealing with reports, reviewing business verification, and preventing misuse.",
            "Anonymous analytics, to see how many people reach each step and improve the site (section 8).",
            "Anything the law requires of us.",
          ],
        },
        "We do not sell your information, use it for advertising or pass it to other companies for marketing. We will ask you before using it for a new purpose, unless the law allows it (information privacy principle 10).",
      ],
    },
    {
      id: "share",
      heading: "5. Who can see your information",
      body: [
        {
          list: [
            'Everyone: jobs, business pages (including approved shop photos and benefits), and any CV share link you create (showing only what you tick). Jobs also show how active the business is: "Online today" when someone in its team used the site today (New Zealand time), and "Usually replies within an hour" or "within a day" when it has answered job seekers quickly over the last 30 days; never the time itself, and never who in the team.',
            "Signed-in job seekers: contact details an employer chooses to make public on a job. Each view is recorded.",
            "Employers: what you send when you apply, and interview arrangements; a CV you send them in a chat, which everyone in the business's team can see. Employers do not see the email you sign in with.",
            'Candidate recommendations: only if you tick "Let employers find my profile in Suggested candidates", employers can see the public part of your profile, without your email or contact details.',
            "Members of the same business's team: the business's chats (including its conversation with Zhaogong moderators), its jobs and who posted them.",
            'Moderators: the content involved when they handle reports and review jobs and business verification. Only moderators can see the chat messages and screenshots attached to a report, and each time one opens them we record which moderator and when; the employer cannot see this evidence and is not told who reported. When a business keeps using the kind of wording described in section 2 in chats, moderators can see those messages, and each time one opens them it is recorded in the same way. When handling a report, business verification or a ban, moderators can talk with the business\'s team: all moderators can see the conversation and which team member wrote each message; the business sees only "Zhaogong moderators", not which moderator. A business that is banned can still see and reply to it.',
            "Providers who store and process data for us: hosting and the database (Cloudflare); the sign-in code emails (Amazon SES, from Amazon Web Services, used only to send the codes). They only keep and process it on our behalf, not for their own use; under section 11 of the Privacy Act 2020 this is not a disclosure to them.",
            "Our staff in China: when needed to run and maintain the site, deal with reports and reviews, and answer your requests (section 6).",
            "AI posting: when an employer posts a job by chatting, the conversation and the job draft (including contact details the employer chooses to make public) are sent to Anthropic's model to be put in order. Anthropic processes them in the United States. Nothing is sent if you don't post by chatting.",
            "Browser message push: a browser vendor's push service (for example Google, Mozilla, Apple or Microsoft) processes the endpoint and connection information needed to send and deliver the alert. The browser-held keys encrypt the alert. We send only a generic new-message alert, not chat text, contact details, a CV or the other person's name.",
            "If the law requires it, or to prevent a serious threat to someone's safety, we may give information to the authorities (information privacy principle 11).",
          ],
        },
      ],
    },
    {
      id: "where",
      heading: "6. Where it is kept, and whether it leaves New Zealand",
      body: [
        "The site's data is kept in Cloudflare data centres in Oceania (Cloudflare D1; Cloudflare decides which city), held for us by Cloudflare.",
        "Sign-in code emails are sent by Amazon SES in Sydney, Australia, using your email address and the code. If an email bounces or you mark it as spam, the address stays on SES's suppression list and is not sent to again.",
        "Staff of the company in China can access this data, to run and maintain the site, deal with reports and reviews, and answer your requests.",
        "Under section 11 of the Privacy Act 2020, information a provider holds for us is treated as held by us, and our own staff using it is our use of it, not a disclosure to anyone else. So neither is a disclosure overseas under information privacy principle 12, but we remain fully responsible for your information, use and protect it as this page says, and only let staff who need it for their work access it.",
        "AI posting content is processed by Anthropic in the United States (section 5). United States law may not protect personal information as fully as New Zealand's does; if you don't want that, post the job by pasting or filling in the form, which sends nothing.",
        "When you turn on browser message push, a browser vendor may process the endpoint and connection information outside New Zealand. Its retention and device-notification behaviour are governed by its privacy policy and your device settings. The alert is encrypted with browser keys; we do not send chat text or contact details to it.",
      ],
    },
    {
      id: "cookies",
      heading: "7. Cookies and browser storage",
      body: [
        "We only use the cookies the site needs to work, and no advertising cookies:",
        {
          table: {
            head: ["Name", "What it does", "How long"],
            rows: [
              [
                "__Host-zg_session (zg_session in local development)",
                "Keeps you signed in. It holds a random sign-in token; the server only stores a hash of it.",
                "30 days, or until you sign out",
              ],
              ["zg_lang", "Remembers your interface language.", "1 year"],
              [
                "zg_visitor",
                "A random anonymous number for counting job views and anonymous analytics events (section 8). It is not linked to your account.",
                "1 year",
              ],
              [
                "zg_consent",
                "Remembers whether you agreed to Microsoft Clarity (section 8). Only used once Clarity is turned on.",
                "1 year",
              ],
            ],
          },
        },
        "To make pages faster and keep your work when the connection drops, the site also keeps some copies in your browser: your profile, notifications, chat messages not yet sent to the server, job drafts (24 hours) and so on. They stay on this device only. Deleting your account under Data and account clears them on this device; on other devices, clear them there.",
      ],
    },
    {
      id: "analytics",
      heading: "8. Analytics",
      body: [
        "Our own analytics: we record a few anonymous events, such as opening a job, applying and posting a job, to see how many people reach each step. Each event stores only its name, time, date, the kind of page, the page's language, the role at the time (signed out, job seeker or employer), a public job number, and an anonymous visitor number that changes every day (an HMAC of zg_visitor and the date, with a key kept on the server). It does not store your email, account, business, IP address, full browser details, search words or anything you write. Events are kept for 180 days; only moderators see the totals, and counts under 5 are not shown as numbers. These analytics are never used to judge any one person.",
        "Microsoft Clarity (not turned on yet): we plan to use Microsoft Clarity to understand clicks and scrolling. Once it is on, the site asks you the first time you visit; if you say no it is not loaded and the site works the same, and if you say yes you can withdraw at any time under Analytics settings. Clarity masks all text on the page and everything you type, and pages with chats, CVs, profile editing, sign-in, Me, moderation and the internships section are never recorded. Clarity is run by Microsoft, which keeps the data in its Azure cloud under its own rules (recordings usually for 30 days). It sets cookies such as _clck and _clsk and works out your rough location from your IP address. We never link Clarity to your account, email or business.",
      ],
    },
    {
      id: "keep",
      heading: "9. How long we keep it",
      body: [
        {
          list: [
            "Sign-in codes: valid for 10 minutes. Once a code has been expired for a day, it is deleted the next time someone asks for or checks a code (we keep it that extra day so we can tell you it has expired).",
            "Staying signed in: 30 days, or until you sign out. Expired sign-ins are deleted when someone later asks for or checks a code.",
            "Browser push subscriptions: deleted when you successfully turn off site alerts, the linked session is deleted, the account is deleted, or the push service confirms that the subscription is invalid. Setup-attempt times are deleted with the session or account. Sending stops after a session expires, but we do not promise physical deletion at that instant. Notifications already delivered to a device and information retained by a browser vendor are outside our control; you may need to clear them on the device.",
            "Sign-in code and report counts: they lapse within 24 hours, and lapsed counts are deleted when someone later asks for or checks a code, or sends a report.",
            "Anonymous analytics events: 180 days.",
            "Chat messages and screenshots attached to a report: deleted 180 days after the report is handled, and deleted with your account if you delete it. The report itself (reason and note) is kept.",
            "Shop photos: the file is deleted as soon as the business deletes a photo or a moderator sends it back; the reason it was sent back (without the photo) is kept for 30 days for the business to read.",
            "Records of chat risks (which business, which kind, which message, when): deleted after 90 days, and with the chat when it is deleted (for example when the job seeker deletes their account).",
            "Team invitations: they lapse after 14 days without an answer.",
            "Jobs: they close 30 days after posting and can be renewed; after closing they stay in the employer's job list and are no longer public.",
            "Everything else (profiles, applications, chats, saved jobs, alerts and so on): until you delete your account. We will not keep information longer than we need it (information privacy principle 9), and we regularly review what can be deleted.",
          ],
        },
      ],
    },
    {
      id: "rights",
      heading: "10. Seeing, correcting and deleting your information",
      body: [
        "Seeing it: under Me › Data and account you can download all your data at any time (a JSON file). You can also write to the privacy officer to ask what information we hold about you and to see it. We will answer as soon as we can, and no later than 20 working days after we receive your request (section 44 of the Privacy Act 2020).",
        "Correcting it: you can change most of your profile, jobs and business details yourself. For anything you can't, write to the privacy officer; we will decide and tell you within 20 working days (section 63). If we don't agree to correct it, you can ask us to attach your statement of correction to that information, so that it is read with it whenever the information is used (information privacy principle 7).",
        'Deleting it: under Data and account, type your email to delete your account. This deletes your sign-ins, profile, applications and interviews, CV share link, saved jobs, alerts, team invitations you received and your chats. Some records have to stay so that reports and moderation can be handled, but your email in them is replaced with "deleted account": for example moderation records, team invitations you sent, business verification requests and contact-view records. Copies of chats kept by the other person stay. The business itself stays (reports and moderation records refer to it); if you are its last team member, its chats (including its conversation with Zhaogong moderators), business page and shop photos are deleted and all its jobs are taken down with their contact details cleared.',
        "None of this costs anything.",
        "Browser message alerts: under Me, you can turn alerts on or off for this browser; only turning them on asks for notification permission. An alert only says there is a new message, without the chat text. Opening it first checks your account and identity, and never switches identity for you. Alerts go only to the identity you turned them on in; switching identity pauses them, and after signing out you need to turn them on again.",
        "You can also revoke notification permission in your browser or system settings, but that does not tell our server straight away; subscriptions are deleted as section 9 describes. Alerts may be late or not arrive; the site chat is the record. Your data export includes your subscription details and setup-attempt times.",
        "If your browser cannot safely keep these settings in step across pages, alerts cannot be turned on, but you can still turn them off on the site.",
      ],
    },
    {
      id: "pipl",
      heading: "11. Your rights under China's Personal Information Protection Law",
      body: [
        "Because we handle your information within China (section 1), you can also use these rights under Chapter IV of the Personal Information Protection Law. Write to the privacy officer; there is no charge:",
        {
          list: [
            "To know how we handle your information, decide whether to agree to it, and restrict or refuse our handling of it, unless the law provides otherwise (Article 44).",
            "To see and copy your information, and, where the conditions set by the national cyberspace authority are met, to have it moved to another handler you name (Article 45).",
            "To have inaccurate or incomplete information corrected or completed (Article 46).",
            "Deletion: we must delete your information ourselves when the purpose has been achieved, cannot be achieved or no longer needs it; when we stop the service or the retention period has ended; when you withdraw consent; or when we handle it against the law or our agreement. If we have not, you can ask us to (Article 47).",
            "To withdraw consent you gave at any time; this does not affect what was done before (Article 15). Deleting your account is the most direct way.",
            "To ask us to explain the rules for handling information on this page (Article 48).",
          ],
        },
        "We deal with requests promptly, and give our reasons if we refuse (Article 50); under New Zealand law we also answer within 20 working days (section 10). If we refuse a request, you can bring proceedings in a People's Court, or complain to New Zealand's Privacy Commissioner as section 14 says.",
      ],
    },
    {
      id: "security",
      heading: "12. How we protect it",
      body: [
        "Sign-in codes and tokens are stored only as hashes; the sign-in, language and visitor cookies cannot be read by scripts on the page; contact details are shown to signed-in job seekers as each employer chooses, and every view is recorded; only moderators can open the moderation pages (information privacy principle 5).",
        "If a privacy breach happens that could cause serious harm, we will tell the Privacy Commissioner and the people affected as soon as we can (sections 114 and 115).",
      ],
    },
    {
      id: "age",
      heading: "13. Young people",
      body: [
        "You must be 16 or older to use this site (see the terms of use). Young people have the same rights to see and correct their information as adults. If you think we hold information about someone under 16, contact the privacy officer.",
      ],
    },
    {
      id: "complain",
      heading: "14. Complaints",
      body: [
        "If you think we have mishandled your information, please write to the privacy officer first and we will reply as soon as we can. If you are not satisfied, you can complain to New Zealand's Privacy Commissioner (section 70 of the Privacy Act 2020). Under the Personal Information Protection Law, if we refuse a request to use your rights, you can also bring proceedings in a People's Court (Article 50).",
        {
          links: [
            {
              label: "Complain to the Privacy Commissioner (privacy.org.nz)",
              href: "https://www.privacy.org.nz/your-rights/making-a-complaint-to-the-privacy-commissioner/",
            },
          ],
        },
      ],
    },
    {
      id: "changes",
      heading: "15. Changes to this page",
      body: [
        "When we change this page we update the date at the top; if a change affects your rights or how we use information, we will tell you on the site before it takes effect.",
      ],
    },
  ],
};
