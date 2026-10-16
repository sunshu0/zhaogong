import type { Exchange, ExchangeKind, ExchangePayload } from "@/lib/chat-consent";

/**
 * The exchange requests the demo conversations start with. The side that asks offers its own details first, so
 * each request carries the asker's details: the employer's when a job seeker receives it, the candidate's when an
 * employer does.
 */
export function demoExchangeRequests(isEmployer: boolean): Record<string, Exchange[]> {
  const requests: [string, ExchangeKind, ExchangePayload][] = isEmployer
    ? [
        ["candidate-lin", "contact", contact("林晓的联系方式", "021 ••• 0901（演示）", "demo_chat_contact")],
        [
          "candidate-chen",
          "resume",
          {
            title: "陈雨的简历",
            fields: [
              { label: "称呼", value: "陈雨" },
              { label: "个人介绍", value: "有前厅服务经验，可以周末排班。（演示）" },
            ],
          },
        ],
      ]
    : [
        ["north-tea", "contact", contact("北岸早茶酒家的联系方式", "021 ••• 0901（演示）", "demo_chat_contact")],
        [
          "mt-eden",
          "resume",
          {
            title: "Mt Eden 餐馆的企业资料",
            fields: [
              { label: "企业", value: "Mt Eden 餐馆" },
              { label: "企业介绍", value: "餐饮门店，招聘前厅与厨房同事。（演示）" },
            ],
          },
        ],
      ];
  return Object.fromEntries(
    requests.map(([id, kind, offered]) => [
      id,
      [
        {
          id: `demo-exchange-${id}`,
          kind,
          from: "them",
          status: "pending",
          offered,
          createdAt: "2026-10-13T10:00:00Z",
          demo: true,
        } satisfies Exchange,
      ],
    ]),
  );
}

function contact(title: string, phone: string, wechat: string): ExchangePayload {
  return {
    title,
    fields: [
      { label: "电话", value: phone },
      { label: "微信", value: wechat },
    ],
  };
}
