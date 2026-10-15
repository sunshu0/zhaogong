import { counterpartActs, devRepliesEnabled } from "@/lib/chat-server/dev";
import { currentChatIdentity } from "@/lib/chat-server/identity";
import { chatServerStore } from "@/lib/chat-server/store";
import { EMPTY_CHAT, chatView } from "@/components/seeker/chat-store";

const REPLY_MAX = 2000;

/**
 * Development and browser tests only: the demo counterpart of the signed-in identity's conversation reads the
 * user's messages and/or replies. Body: { conversationId, reply?, readMine? }. 404 in production.
 */
export async function POST(request: Request) {
  if (!devRepliesEnabled()) return new Response(null, { status: 404 });
  const me = await currentChatIdentity();
  if (!me) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    conversationId?: unknown;
    reply?: unknown;
    readMine?: unknown;
  } | null;
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const reply = typeof body?.reply === "string" ? body.reply.slice(0, REPLY_MAX) : undefined;
  const store = chatServerStore();
  const record = (await store.getChat(me.scope)) ?? EMPTY_CHAT;
  if (!chatView(record, me.demo).messages[conversationId]) {
    return Response.json({ error: "没有这个对话" }, { status: 400 });
  }
  const next = counterpartActs(
    record,
    conversationId,
    { reply, readMine: body?.readMine === true },
    new Date().toISOString(),
  );
  await store.putChat(me.scope, next);
  return Response.json(next);
}
