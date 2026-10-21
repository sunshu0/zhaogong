// A canonical membership snapshot for decisions made in JavaScript. Capture before reading the team; compare
// again inside the write so a concurrent promotion, removal or join cannot invalidate that decision (ADR 0031).
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";

export function membershipState(employerId: string): SQL {
  return sql`(select json_group_array(json_array(email, team_role)) from (
    select email, team_role from accounts where employer_id = ${employerId} order by email
  ))`;
}

export async function unchangedMembership(db: Db, employerId: string): Promise<SQL> {
  const state = membershipState(employerId);
  const row = await db.get<{ version: string }>(sql`select ${state} as version`);
  return sql`${state} = ${row!.version}`;
}

/** Invitation limits depend on members, pending invitations, links and the invited account's identity. */
export async function unchangedTeam(db: Db, employerId: string, targetEmail = ""): Promise<SQL> {
  const state = sql`json_array(
    ${membershipState(employerId)},
    (select json_group_array(json_array(id, email, role, created_at, status)) from (
      select id, email, role, created_at, status from team_invites where employer_id = ${employerId} order by id
    )),
    (select json_group_array(json_array(id, created_at, status)) from (
      select id, created_at, status from team_invite_links where employer_id = ${employerId} order by id
    )),
    (select json_array(email, employer_id) from accounts where email = ${targetEmail}),
    (select json_array(banned_at) from employers where id = ${employerId})
  )`;
  const row = await db.get<{ version: string }>(sql`select ${state} as version`);
  return sql`${state} = ${row!.version}`;
}
