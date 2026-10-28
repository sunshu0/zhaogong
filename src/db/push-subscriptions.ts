import { and, eq, gt, lt, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import type { BrowserSubscription, PushRole } from "@/lib/push/rules";
import type { Lang } from "@/i18n/lang";
import type { SessionView } from "@/lib/auth/sessions";
import { insertIf } from "@/db/write-if";

export type PushOwner = { id: string; view: SessionView };
const ownership = (owner: PushOwner) =>
  and(eq(t.pushSubscriptions.email, owner.view.email), eq(t.pushSubscriptions.sessionId, owner.id));
/** One setup attempt per ten seconds per login, checked atomically. Closing alerts is never throttled. */
export async function claimPushAttempt(owner: PushOwner, now = new Date()): Promise<boolean> {
  const db = await database();
  const rows = await db
    .insert(t.pushSetups)
    .values({ sessionId: owner.id, attemptedAt: now.toISOString() })
    .onConflictDoUpdate({
      target: t.pushSetups.sessionId,
      set: { attemptedAt: now.toISOString() },
      setWhere: lt(t.pushSetups.attemptedAt, new Date(now.getTime() - 10_000).toISOString()),
    })
    .returning({ id: t.pushSetups.sessionId });
  return rows.length === 1;
}
export async function ownsPushSubscription(owner: PushOwner, endpoint: string): Promise<boolean> {
  const db = await database();
  const [row] = await db
    .select({ role: t.pushSubscriptions.role })
    .from(t.pushSubscriptions)
    .where(and(ownership(owner), eq(t.pushSubscriptions.endpoint, endpoint)));
  return row?.role === owner.view.activeRole;
}
/** Refuses another account/session's endpoint, even if it is submitted with different keys. No transferable ownership. */
export async function keepPushSubscription(
  owner: PushOwner,
  subscription: BrowserSubscription,
  lang: Lang,
  now = new Date(),
): Promise<boolean> {
  const db = await database();
  const at = now.toISOString();
  const value = {
    sessionId: owner.id,
    email: owner.view.email,
    role: owner.view.activeRole,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    lang,
    updatedAt: at,
  };
  // Bound storage per login device, including concurrent requests; an existing endpoint may always refresh.
  const room = sql`(select count(*) from ${t.pushSubscriptions} where ${t.pushSubscriptions.sessionId} = ${owner.id}) < 10
    or exists (select 1 from ${t.pushSubscriptions} where ${t.pushSubscriptions.endpoint} = ${subscription.endpoint})`;
  await insertIf(
    db,
    t.pushSubscriptions,
    { endpoint: subscription.endpoint, ...value, createdAt: at },
    room,
  ).onConflictDoUpdate({ target: t.pushSubscriptions.endpoint, set: value, setWhere: ownership(owner) });
  return ownsPushSubscription(owner, subscription.endpoint);
}
export async function removePushSubscription(owner: PushOwner, endpoint: string): Promise<void> {
  const db = await database();
  await db.delete(t.pushSubscriptions).where(and(ownership(owner), eq(t.pushSubscriptions.endpoint, endpoint)));
}
/** A departed team member, expired/signed-out session or a session in another role receives nothing. */
export async function pushRecipients(
  conversation: { seekerEmail: string; employerId: string },
  role: PushRole,
  now = new Date(),
) {
  const db = await database();
  return db
    .select({ subscription: t.pushSubscriptions })
    .from(t.pushSubscriptions)
    .innerJoin(
      t.sessions,
      and(eq(t.sessions.id, t.pushSubscriptions.sessionId), eq(t.sessions.email, t.pushSubscriptions.email)),
    )
    .innerJoin(t.accounts, eq(t.accounts.email, t.pushSubscriptions.email))
    .where(
      and(
        eq(t.pushSubscriptions.role, role),
        eq(t.sessions.activeRole, role),
        gt(t.sessions.expiresAt, now.toISOString()),
        role === "seeker"
          ? eq(t.accounts.email, conversation.seekerEmail)
          : eq(t.accounts.employerId, conversation.employerId),
        // Staff accounts do not use job-seeker/employer chats.
        sql`not exists (select 1 from ${t.moderators} where ${t.moderators.email} = ${t.accounts.email})`,
      ),
    )
    .limit(50);
}
export async function discardExpiredPush(endpoint: string, sessionId: string, updatedAt: string): Promise<void> {
  const db = await database();
  await db
    .delete(t.pushSubscriptions)
    .where(
      and(
        eq(t.pushSubscriptions.endpoint, endpoint),
        eq(t.pushSubscriptions.sessionId, sessionId),
        eq(t.pushSubscriptions.updatedAt, updatedAt),
      ),
    );
}
