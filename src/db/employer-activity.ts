// 老板活跃度 (#381, ADR 0038): when a business's team last used the site, and how soon it answered the job seekers who
// wrote to it, for a whole list of jobs at once (two statements, whatever the number of businesses). Server only.
import { and, eq, gte, lt, or, sql, isNull } from "drizzle-orm";
import { database } from "@/db/ready";
import { inList } from "@/db/in-list";
import * as t from "@/db/schema";
import { employerActivity, REPLY_WINDOW_MS, type EmployerActivity, type FirstReply } from "@/lib/employer-activity";

/** How often a business's last use is written at most: the pages only say whether it was today. */
const WRITE_EVERY_MS = 10 * 60_000;

/** Someone in the business's team is using the site now. One statement; writes nothing within 10 minutes of the last. */
export async function markEmployerActive(employerId: string, now = new Date()): Promise<void> {
  const db = await database();
  const at = now.toISOString();
  const before = new Date(now.getTime() - WRITE_EVERY_MS).toISOString();
  await db
    .insert(t.employerActivity)
    .values({ employerId, lastActiveAt: at })
    .onConflictDoUpdate({
      target: t.employerActivity.employerId,
      set: { lastActiveAt: at },
      setWhere: or(isNull(t.employerActivity.lastActiveAt), lt(t.employerActivity.lastActiveAt, before)),
    });
}

/** What the job pages may say about each business, by id; a business with nothing to say has an empty object. */
export async function employerActivities(
  employerIds: readonly string[],
  now = Date.now(),
): Promise<Map<string, EmployerActivity>> {
  const ids = [...new Set(employerIds)];
  if (!ids.length) return new Map();
  const db = await database();
  const since = new Date(now - REPLY_WINDOW_MS).toISOString();
  const [seen, firsts] = await Promise.all([
    db.select().from(t.employerActivity).where(inList(t.employerActivity.employerId, ids)),
    // Per conversation with something said in the window: the job seeker's first message and the business's first.
    db
      .select({
        employerId: t.conversations.employerId,
        askedId: sql<number | null>`min(case when ${t.messages.from} = 'seeker' then ${t.messages.id} end)`,
        askedAt: sql<string | null>`min(case when ${t.messages.from} = 'seeker' then ${t.messages.sentAt} end)`,
        repliedId: sql<number | null>`min(case when ${t.messages.from} = 'employer' then ${t.messages.id} end)`,
        repliedAt: sql<string | null>`min(case when ${t.messages.from} = 'employer' then ${t.messages.sentAt} end)`,
      })
      .from(t.conversations)
      .innerJoin(t.messages, eq(t.messages.conversationId, t.conversations.id))
      .where(and(inList(t.conversations.employerId, ids), gte(t.conversations.updatedAt, since)))
      .groupBy(t.conversations.id),
  ]);
  const lastActive = new Map(seen.map((row) => [row.employerId, row.lastActiveAt]));
  const asked = new Map<string, FirstReply[]>();
  for (const row of firsts) {
    // Only conversations the job seeker started: an answer to the business's own first message is not a reply.
    if (row.askedId == null || !row.askedAt || (row.repliedId != null && row.repliedId < row.askedId)) continue;
    const list = asked.get(row.employerId) ?? [];
    list.push({ askedAt: row.askedAt, repliedAt: row.repliedAt });
    asked.set(row.employerId, list);
  }
  return new Map(
    ids.map((id) => [
      id,
      employerActivity({ lastActiveAt: lastActive.get(id), conversations: asked.get(id) ?? [] }, now),
    ]),
  );
}
