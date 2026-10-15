// The signed-in identity whose chat the server reads and writes (#10). Server only.
import { getCurrentSession, type SessionView } from "@/lib/auth";
import { chatDemo } from "@/components/seeker/chat-demo";
import { identityScope } from "@/components/seeker/identity-scope";

export type ChatIdentity = {
  session: SessionView;
  isEmployer: boolean;
  /** The key the browser's copy uses too (identityScope). */
  scope: string;
  demo: ReturnType<typeof chatDemo>;
};

export async function currentChatIdentity(): Promise<ChatIdentity | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const isEmployer = session.activeRole === "employer";
  return { session, isEmployer, scope: scopeOf(session), demo: chatDemo(isEmployer) };
}

export function scopeOf(session: SessionView): string {
  return identityScope({
    email: session.email,
    signedInAt: "",
    activeRole: session.activeRole,
    employerId: session.employer?.id,
  });
}
