// Two identities on one account: every account can look for work, and can open an employer identity for one
// business. Pure helpers for sign-up, switching and the header's 发布招聘. Client and server both use them.
import { COUNTRIES } from "@/config/countries";
import type { CountryCode } from "@/lib/types";
import {
  clearSession,
  readSession,
  requestIdentity,
  updateIdentity,
  writeSession,
  type ActiveRole,
  type DemoSession,
  type SessionIdentity,
  type StorageLike,
} from "@/components/seeker/session";

/** Demo businesses an employer can pick at sign-up. Any other existing business cannot be claimed from here. */
export const DEMO_BUSINESS_IDS = ["e1", "e2", "e4"] as const;

export const POST_JOB_PATH = "/employer/post";

const NAME_MAX = 40;

export type BusinessChoice = { kind: "existing"; employerId: string } | { kind: "new"; name: string; regionId: string };

export function parseRole(value: string | string[] | undefined): ActiveRole {
  return (Array.isArray(value) ? value[0] : value) === "employer" ? "employer" : "seeker";
}

/** Checks what the business step sent; used again on the server, where it decides what is created or claimed. */
export function parseBusinessChoice(
  input: unknown,
  country: CountryCode,
): { ok: true; choice: BusinessChoice } | { ok: false; error: string } {
  const value = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (value.kind === "new") {
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (!name) return { ok: false, error: "请填写店名" };
    if (name.length > NAME_MAX) return { ok: false, error: `店名最多 ${NAME_MAX} 个字` };
    const regionId = COUNTRIES[country].regions.find((r) => r.id === value.regionId)?.id;
    if (!regionId) return { ok: false, error: "请选择地区" };
    return { ok: true, choice: { kind: "new", name, regionId } };
  }
  const id = DEMO_BUSINESS_IDS.find((d) => d === value.employerId);
  if (value.kind !== "existing" || !id) return { ok: false, error: "请选择一家店" };
  return { ok: true, choice: { kind: "existing", employerId: id } };
}

/**
 * The business step's first choice: the first demo shop no account has bound yet, else a new business. The demo
 * data is shared by everyone online, so the default must be one that can go through.
 */
export function defaultBusinessChoice(businesses: readonly { id: string; claimed: boolean }[]): string {
  return businesses.find((b) => !b.claimed)?.id ?? "new";
}

export function employerSignUpHref(next: string = POST_JOB_PATH): string {
  return `/login?role=employer&next=${encodeURIComponent(next)}`;
}

/** The header's 发布招聘: straight to posting with an employer identity, else through employer sign-up. */
export function postJobHref(session: DemoSession | null): string {
  return session?.employerId ? POST_JOB_PATH : employerSignUpHref();
}

export function identityLabel(session: DemoSession): string {
  return session.activeRole === "employer" && session.employerName ? `雇主 · ${session.employerName}` : "求职者";
}

export function openErrorMessage(reason: "no_employer" | "banned" | "taken" | "already_employer"): string {
  switch (reason) {
    case "taken":
      return "这家店已被其他账号绑定。如果是你的店，请联系我们；也可以新建企业。";
    case "banned":
      return "这家企业已被停用，不能再绑定。";
    case "no_employer":
      return "找不到这家企业，请重新选择。";
    case "already_employer":
      return "这个账号已经绑定了另一家企业。";
  }
}

/** The identity to use, given what the server says about the account: the business always comes from the server. */
export function reconcileIdentity(
  wanted: ActiveRole,
  server: { email?: string; employer?: { id: string; name: string } },
): SessionIdentity {
  return server.employer ? { activeRole: wanted, employer: server.employer } : { activeRole: "seeker" };
}

/** Apply an account lookup to the current session without undoing a newer identity choice or sign-in. */
export function syncSessionIdentity(
  storage: StorageLike,
  requested: DemoSession,
  server: Parameters<typeof reconcileIdentity>[1],
): DemoSession | null {
  const current = readSession(storage);
  if (
    !current ||
    current.email !== requested.email ||
    current.signedInAt !== requested.signedInAt ||
    current.employerId !== requested.employerId
  ) {
    return current;
  }
  const identity = reconcileIdentity(current.activeRole, server);
  // A newer switch still waiting for its own answer stays marked, so it is sent again if that answer is lost.
  const newer =
    current.switching !== undefined &&
    current.activeRole !== requested.activeRole &&
    identity.activeRole === current.switching;
  return newer ? requestIdentity(storage, identity) : updateIdentity(storage, identity);
}

/** The browser's view of the server's session (login actions' AccountStatus). */
export type ServerSession = { email: string; activeRole: ActiveRole; employer?: { id: string; name: string } };

/**
 * After a page load: the identity to ask the server for again, when the copy holds a switch the server has not made
 * (the page was left before the request arrived). Null when there is nothing to send.
 */
export function unconfirmedSwitch(requested: DemoSession | null, server: ServerSession | null): ActiveRole | null {
  if (!requested?.switching || !server || server.email !== requested.email) return null;
  return server.activeRole === requested.switching ? null : requested.switching;
}

/**
 * Make the browser's copy match the server's session (A12-1): the cookie session is the truth, the copy is for
 * display. `requested` is the copy when the question was asked; if it changed since (a sign-in, sign-out or
 * switch in between), the answer is out of date and the copy is left alone.
 */
export function applyServerSession(
  storage: StorageLike,
  requested: DemoSession | null,
  server: ServerSession | null,
  now = new Date(),
): DemoSession | null {
  const current = readSession(storage);
  const unchanged =
    current?.email === requested?.email &&
    current?.signedInAt === requested?.signedInAt &&
    current?.activeRole === requested?.activeRole &&
    current?.employerId === requested?.employerId;
  if (!unchanged) return current;
  if (!server) {
    clearSession(storage);
    return null;
  }
  const since = current?.email === server.email ? new Date(current.signedInAt) : now;
  return writeSession(storage, server.email, since, { activeRole: server.activeRole, employer: server.employer });
}
