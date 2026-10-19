// #323: the terms of use (/terms), written to the New Zealand laws that apply whoever runs the site, because its
// users are in New Zealand: employment and job-ad law (minimum wage, Human Rights Act, Wages Protection Act s 12A,
// Immigration Act), the Fair Trading Act (no misleading ads; no unfair standard-form terms) and the Consumer
// Guarantees Act (no contracting out). Who runs the site and the governing law are not decided yet: square brackets.
// Sources are in the PR. The blocks and sections share legal-privacy.ts's shape.
import type { Dictionary } from "@/i18n/messages";
import type { LegalSection } from "@/i18n/messages/legal-privacy";

const legalTermsZh = {
  title: "使用条款",
  description: "使用本网站的规则：网站是什么、不是什么，发布职位要守的法律，禁止的内容，举报、账号和责任。",
  updated: "最后更新：2026 年 10 月 20 日",
  placeholders: "方括号里的内容（比如「[公司名称]」）还没有定，正式上线前会填上。",
  tocLabel: "目录",
  sections: [
    {
      id: "about",
      heading: "1. 关于这些条款",
      body: [
        "本网站由 [公司名称]（[公司地址]）运营。下文的「我们」指运营方，「你」指使用本网站的人，包括求职者和雇主。",
        "你使用本网站，就表示同意这些条款和隐私说明。不同意的话，请不要使用。",
      ],
    },
    {
      id: "what",
      heading: "2. 本网站是什么、不是什么",
      body: [
        "本网站让雇主发布职位、让求职者找工作并跟雇主联系。求职者使用是免费的。",
        {
          list: [
            "我们不是雇主，也不是职业中介：雇用关系只在雇主和求职者之间，工资、工时、合同和工作条件由他们双方约定。",
            "我们不代表任何一方谈判，不保证某个职位一定招到人，也不保证某个求职者一定被录用。",
            "我们会在发布前自动检查职位，并处理举报，但不能逐条核实每个职位和每个人说的话。「已验证企业」只表示我们核对过企业登记和联系人，不是对这家企业的担保。",
            "我们不提供签证或移民建议。职位和主页上的签证信息只是双方自己说明的情况，有疑问请看新西兰移民局的官方信息或咨询持牌移民顾问。",
          ],
        },
      ],
    },
    {
      id: "account",
      heading: "3. 账号",
      body: [
        {
          list: [
            "你需要年满 16 岁才能使用本网站。",
            "你用邮箱和一次性验证码登录。请保管好你的邮箱，不要把验证码告诉别人。一个账号只给一个人用。",
            "用雇主身份时，你必须是那家企业的人，或者得到了企业授权。团队里谁能做什么，按团队页面上的身份决定。",
            "你填写的信息要真实，有变化时请更新。",
            "你可以随时在「我的 › 数据与账号」里删除账号，删除后会发生什么见隐私说明。",
          ],
        },
      ],
    },
    {
      id: "employers",
      heading: "4. 雇主发布职位必须守法",
      body: [
        "雇主对自己发布的职位负责，发布前必须确认职位符合新西兰法律，包括：",
        {
          list: [
            "最低工资：工资不能低于新西兰现行的法定最低工资（《1983 年最低工资法》）。最低工资每年调整，以新西兰就业网站公布的为准。",
            "不得歧视：不能因为性别、婚姻状况、宗教或伦理信仰、肤色、种族、民族或国籍（包括国籍和公民身份）、残疾、年龄、政治观点、就业状况、家庭状况或性取向，拒绝录用或给出更差的条件，也不能发布表示这种意图的广告（《1993 年人权法》第 21、22、23、67 条）。要求会某种语言，必须是这份工作确实需要，并且有正当理由（第 65 条）。",
            "不得收费：不能以任何名义向求职者收取录用费、押金、介绍费或其他「好处费」（《1983 年工资保护法》第 12A 条）。",
            "移民法：只能让有权在新西兰做这份工作的人上班；不能雇用无权工作的人，不能剥削临时工作签证的员工（《2009 年移民法》第 350、351 条）。不要在职位上承诺你做不到的签证或担保。",
            "真实准确：职位、工资、工时、地点和条件必须真实，不能误导求职者（《1986 年公平交易法》第 9、13 条）。",
            "联系方式：职位上的联系方式只能是用于招聘的，并按你选的方式给登录的求职者看，或者在聊天里交换。",
          ],
        },
        {
          links: [
            {
              label: "现行最低工资（employment.govt.nz）",
              href: "https://www.employment.govt.nz/pay-and-hours/pay-and-wages/minimum-wage/minimum-wage-rates-and-types",
            },
          ],
        },
        "我们的自动检查只是辅助，没查出来不代表合法。",
      ],
    },
    {
      id: "forbidden",
      heading: "5. 禁止的内容和行为",
      body: [
        {
          list: [
            "虚假或误导的职位，或者其实不是招聘的广告（比如推销、加盟、传销、贷款）。",
            "向求职者收费，或者要求先交押金、先买东西、先付培训费。",
            "歧视、骚扰、威胁、仇恨言论，或者侵犯别人隐私的内容。",
            "违法的工作：工资低于最低工资、无权工作的人做的工作、色情服务以及其他违法的工作。",
            "冒充别人或别的企业。",
            "把别人的联系方式、简历或聊天内容拿到本网站以外用，或者给求职者、雇主发垃圾信息。",
            "用程序大量抓取网站内容，或者干扰网站运行。",
          ],
        },
      ],
    },
    {
      id: "report",
      heading: "6. 举报和下架",
      body: [
        "每个职位页上都有「举报这个职位」，不用登录也能举报。聊天里的问题，或者其他要我们处理的内容，请写信到 [联系邮箱]。",
        "审核员会处理举报。违反这些条款或法律的内容，我们可以下架；情节严重或屡次违反的，我们可以停用账号或封禁企业。我们会告诉你原因，你可以写信要求我们复查。",
        "对网上有害内容的投诉，我们按新西兰《2015 年有害数字通讯法》第 24 条处理：收到符合要求的投诉后 48 小时内通知发布者，发布者可以在 48 小时内答复，然后按法律规定保留或删除。你也可以联系法定受理机构 Netsafe。",
        { links: [{ label: "Netsafe（netsafe.org.nz）", href: "https://netsafe.org.nz/" }] },
      ],
    },
    {
      id: "content",
      heading: "7. 你发布的内容",
      body: [
        "你发布的职位、主页和消息仍然属于你。你允许我们为了运营本网站展示、存储和处理这些内容，比如在职位列表里显示职位、把申请交给雇主。你删除内容或账号后，我们不再展示（隐私说明里写的保留情况除外）。",
        "你要保证你有权发布这些内容。",
      ],
    },
    {
      id: "service",
      heading: "8. 服务的变更和中断",
      body: [
        "我们会尽量让网站正常运行，但可能因为维护、故障或其他原因暂时用不了。我们可能改进或调整功能；如果要停止某项你正在用的主要服务，会提前在网站上告诉你。",
      ],
    },
    {
      id: "liability",
      heading: "9. 责任",
      body: [
        "职位和主页的内容由发布的人负责。雇主和求职者之间的雇用关系、工资和工作条件，由他们双方负责。",
        "在法律允许的范围内，我们不对用户之间的约定、用户发布的内容，或者第三方网站（比如外部职位链接到的公司官网）负责。",
        "这些条款没有任何内容会排除、限制或改变你依照《1993 年消费者保障法》和《1986 年公平交易法》享有、而依法不能排除的权利。",
      ],
    },
    {
      id: "changes",
      heading: "10. 条款的变更",
      body: [
        "我们可能修改这些条款。修改会更新页面顶部的日期；对你不利的重要修改，会在生效前在网站上告诉你。你不同意的话，可以在生效前删除账号。",
      ],
    },
    {
      id: "law",
      heading: "11. 适用法律",
      body: [
        "这些条款适用新西兰法律。因这些条款或使用本网站产生的争议，由新西兰的法院或争议法庭（Disputes Tribunal）处理。",
        "新西兰保护消费者、劳动者和求职者的强制性规定，照样适用于在新西兰的用户。",
        {
          links: [
            { label: "新西兰争议法庭（disputestribunal.govt.nz）", href: "https://www.disputestribunal.govt.nz/" },
          ],
        },
      ],
    },
    {
      id: "contact",
      heading: "12. 联系我们",
      body: ["[公司名称]，[公司地址]，[联系邮箱]。"],
    },
  ] satisfies readonly LegalSection[],
};

export const legalTermsMessages: Dictionary<typeof legalTermsZh> = { key: "legalTerms", zh: legalTermsZh };
