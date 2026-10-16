// The signed-in identity whose chat the server reads and writes (#10). Server only.
import { getCurrentSession, type SessionView } from "@/lib/auth";
import { getAccount } from "@/lib/data";
import { chatServerStore } from "@/lib/chat-server/store";
import type { ChatRecord } from "@/components/seeker/chat-store";
import { chatDemo } from "@/components/seeker/chat-demo";
import { isDemoAccount } from "@/lib/demo-accounts";
import { identityScope } from "@/components/seeker/identity-scope";

export type ChatIdentity = {
  session: SessionView;
  isEmployer: boolean;
  /** The key the browser's copy uses too (identityScope); notification reads and change tickets are kept under it. */
  scope: string;
  /**
   * Where the chat record itself is kept: the identity's own scope for a job seeker, the business's for an employer,
   * so everyone in its team sees the same conversations (#87).
   */
  recordScope: string;
  /** The name an employer goes by in its team, written on what it sends (#87). */
  by?: string;
  demo: ReturnType<typeof chatDemo>;
};

export async function currentChatIdentity(): Promise<ChatIdentity | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const isEmployer = session.activeRole === "employer";
  const scope = scopeOf(session);
  const demoAccount = isDemoAccount(session.email);
  if (!isEmployer || !session.employer)
    return { session, isEmployer, scope, recordScope: scope, demo: chatDemo(false, demoAccount) };
  const by = (await getAccount(session.email))?.teamName;
  return {
    session,
    isEmployer,
    scope,
    recordScope: teamChatScope(session.employer.id),
    ...(by ? { by } : {}),
    demo: chatDemo(true, demoAccount),
  };
}

/** The key of a business's shared chat record (#87). */
export function teamChatScope(employerId: string): string {
  return `team:${employerId}`;
}

export function isTeamChatScope(scope: string): boolean {
  return scope.startsWith("team:");
}

/**
 * The identity's chat record. Before #87 an employer's chats were its own; a business without a shared record yet
 * starts from the reader's own copy, which the first write then keeps as the business's.
 */
export async function readChat(me: Pick<ChatIdentity, "scope" | "recordScope">): Promise<ChatRecord | undefined> {
  const store = chatServerStore();
  const record = await store.getChat(me.recordScope);
  if (record || me.recordScope === me.scope) return record;
  return store.getChat(me.scope);
}

export function scopeOf(session: SessionView): string {
  return identityScope({
    email: session.email,
    signedInAt: "",
    activeRole: session.activeRole,
    employerId: session.employer?.id,
  });
}
