import type { Exchange, ExchangeKind, ExchangePayload } from "@/lib/chat-consent";

export function demoExchangeRequests(isEmployer: boolean): Record<string, Exchange[]> {
  const ids = isEmployer ? ["candidate-lin", "candidate-chen", "candidate-wang"] : ["north-tea", "mt-eden", "clean-home"];
  const names = isEmployer ? ["林晓", "陈雨", "王宁"] : ["北岸早茶酒家", "Mt Eden 餐馆", "洁净家政"];
  const kinds: ExchangeKind[] = ["contact", "resume", "address"];
  const payloads: ExchangePayload[] = [
    { title: "演示联系方式", fields: [{ label: "电话", value: "021 555 0901（演示）" }, { label: "微信", value: "demo_chat_contact" }] },
    { title: isEmployer ? "演示求职简历" : "演示企业资料", fields: [{ label: isEmployer ? "求职者" : "企业", value: names[1] }, { label: "介绍", value: isEmployer ? "有前厅服务经验，可以周末排班。（演示）" : "餐饮门店，招聘前厅与厨房同事。（演示）" }] },
    { title: "演示地址", fields: [{ label: "地址", value: "示例面谈地点 · 奥克兰（演示）" }] },
  ];
  return Object.fromEntries(ids.map((id, index) => [id, [{ id: `demo-exchange-${id}`, kind: kinds[index], from: "them", status: "pending", offered: payloads[index], createdAt: "2026-10-13T10:00:00Z", demo: true } satisfies Exchange]]));
}
