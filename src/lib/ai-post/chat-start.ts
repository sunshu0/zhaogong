// How a posting chat starts: the greeting, with a sample post to try.
import { PRODUCT_NAME } from "@/i18n/labels";
import type { CountryCode } from "@/lib/types";
import type { ChatState } from "./chat-state";

export const SAMPLE_POST = `【急招】Mt Eden 川菜馆招前厅服务员 2 名
时薪 $25-27，每周 15-25 小时，周五至周日晚班
包工作餐，接受学签，需会普通话和基本英语
有意者请加微信 demo_chuanwei`;

export function startChat(country: CountryCode): ChatState {
  return {
    country,
    draft: { country },
    messages: [
      {
        id: "m1",
        from: "assistant",
        text: `你好！我是${PRODUCT_NAME}的发帖助手，一步步帮你把招聘写清楚。\n先用你自己的话说说这份工作：招什么人、在哪个区、时薪多少。直接粘贴微信群里的招聘消息也行。`,
        quickReplies: [{ label: "用示例试试", value: SAMPLE_POST }],
      },
    ],
    asking: "description",
    asked: [],
    unsure: [],
    noted: [],
    ready: false,
  };
}
