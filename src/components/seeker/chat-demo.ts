import type { ChatDemo, Conversation, Message } from "@/components/seeker/chat-store";
import { demoExchangeRequests } from "@/mock/chat-exchanges";

// The demo conversations each identity starts with. Only what the user does is stored (chat-store.ts); these
// are merged in when the chat is read, so changing them never wipes a user's own messages.

export const CONVERSATIONS: Conversation[] = [
  {
    id: "north-tea",
    person: "北岸早茶酒家",
    title: "点心师傅", // j3
    time: "10:42",
    avatar: "北",
    job: "j3",
    employerId: "e2",
  },
  {
    id: "mt-eden",
    person: "Mt Eden 餐馆",
    title: "前厅服务员",
    time: "昨天",
    avatar: "M",
    job: "j1",
    employerId: "e1",
  },
  { id: "clean-home", person: "洁净家政", title: "清洁员", time: "周一", avatar: "洁", job: "j10", employerId: "e6" },
];
const EMPLOYER_CONVERSATIONS: Conversation[] = [
  { id: "candidate-lin", person: "林晓", title: "前厅服务员", time: "10:42", avatar: "林", job: null },
  { id: "candidate-chen", person: "陈雨", title: "前厅服务员", time: "昨天", avatar: "陈", job: null },
  { id: "candidate-wang", person: "王宁", title: "厨房帮工", time: "周一", avatar: "王", job: null },
];

type DemoStart = { messages: Record<string, Message[]>; unread: Record<string, number> };
const SEEKER_START: DemoStart = {
  unread: { "north-tea": 2, "mt-eden": 1, "clean-home": 0 },
  messages: {
    "north-tea": [
      { from: "them", text: "你好，你的时间安排怎么样？", time: "10:35" },
      {
        from: "me",
        text: "你好！我周一到周六下午都可以，普通话和英语都能沟通。",
        time: "10:39",
        readAt: "2026-10-13T00:00:00Z",
      },
      { from: "them", text: "方便今天下午聊一下吗？也可以先交换联系方式。", time: "10:42" },
    ],
    "mt-eden": [
      { from: "them", text: "你好，感谢你对我们职位感兴趣。", time: "昨天" },
      { from: "me", text: "你好，我想了解一下具体的工作时间。", time: "昨天", readAt: "2026-10-12T00:00:00Z" },
      { from: "them", text: "我们可以安排面谈。", time: "昨天" },
    ],
    "clean-home": [{ from: "them", text: "已查看你的简历，有合适的班次会联系你。", time: "周一" }],
  },
};
const EMPLOYER_START: DemoStart = {
  unread: { "candidate-lin": 1, "candidate-chen": 3, "candidate-wang": 0 },
  messages: {
    "candidate-lin": [
      { from: "me", text: "你好，方便今天下午到店面谈吗？", time: "10:35", readAt: "2026-10-13T00:00:00Z" },
      { from: "them", text: "您好，我有前厅服务经验，今天下午可以到店面谈。", time: "10:42" },
    ],
    "candidate-chen": [{ from: "them", text: "您好，我想应聘前厅服务员，可以先发简历给您吗？", time: "昨天" }],
    "candidate-wang": [{ from: "them", text: "谢谢，面试时间收到了。", time: "周一" }],
  },
};

const SEEKER_DEMO: ChatDemo = { conversations: CONVERSATIONS, ...SEEKER_START, exchanges: demoExchangeRequests(false) };
const EMPLOYER_DEMO: ChatDemo = {
  conversations: EMPLOYER_CONVERSATIONS,
  ...EMPLOYER_START,
  exchanges: demoExchangeRequests(true),
};

export function chatDemo(isEmployer: boolean): ChatDemo {
  return isEmployer ? EMPLOYER_DEMO : SEEKER_DEMO;
}
