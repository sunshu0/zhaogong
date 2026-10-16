"use server";

// 企业验证 for /admin (#78, PRD R-16, ADR 0011): the applications waiting, and approving or rejecting one after the
// checklist. A moderator only (requireModerator, as every /admin Server Function); each decision goes into the log
// with who made it (#60).
import { addModerationLog, getEmployer, listEmployers } from "@/lib/data";
import type { Employer } from "@/lib/types";
import { buildRegister, findInRegister, type RegisterEntry } from "@/components/employer/business-register";
import {
  checklistFor,
  KIND_LABELS,
  missingChecks,
  parseRejection,
  REJECT_REASONS,
  sanitizeChecklist,
  type CheckItem,
} from "@/components/employer/verification";
import {
  decideVerification,
  listPendingVerifications,
  type Decision,
  type VerificationRequest,
} from "@/db/verification-requests";
import { describeAction } from "@/app/admin/moderation";
import { REFUSED_ZH, requireModerator } from "@/app/admin/moderator";
import type { AdminResult, Refused } from "@/app/admin/actions";

export interface VerificationItem {
  request: Omit<VerificationRequest, "submittedByEmail" | "decidedByEmail">;
  /** The business as it is now (its badge, a ban). */
  employer?: Employer;
  /** The register's entry for the NZBN, to set beside what the employer wrote. */
  register?: RegisterEntry;
  checklist: CheckItem[];
}

function item(
  request: VerificationRequest,
  employer: Employer | undefined,
  register: RegisterEntry[],
): VerificationItem {
  const view: Partial<VerificationRequest> = { ...request };
  delete view.submittedByEmail;
  delete view.decidedByEmail;
  return {
    request: view as VerificationItem["request"],
    employer,
    register: findInRegister(register, request.nzbn),
    checklist: checklistFor(request),
  };
}

/** The applications waiting for a moderator, oldest first. */
export async function getVerificationQueue(): Promise<VerificationItem[] | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: REFUSED_ZH[me.reason] };
  const employers = await listEmployers();
  const register = buildRegister(employers);
  return (await listPendingVerifications()).map((request) =>
    item(
      request,
      employers.find((e) => e.id === request.employerId),
      register,
    ),
  );
}

async function decide(id: unknown, checklistInput: unknown, decision: Decision): Promise<AdminResult> {
  const me = await requireModerator();
  if (!me.ok) return { ok: false, error_zh: REFUSED_ZH[me.reason] };
  const pending = (await listPendingVerifications()).find((r) => r.id === id);
  if (!pending) return { ok: false, error_zh: "这份申请已经处理过，或者不存在。" };
  const employer = await getEmployer(pending.employerId);
  if (decision.approve && employer?.bannedAt) return { ok: false, error_zh: "这家店已被封禁，不能通过验证。" };

  const items = checklistFor(pending);
  const checklist = sanitizeChecklist(checklistInput, items);
  const missing = missingChecks(items, checklist);
  if (decision.approve && missing.length)
    return { ok: false, error_zh: `还有核对项没打勾：${missing.map((i) => i.label).join("、")}。` };

  const decided = await decideVerification(pending.id, me.email, checklist, decision);
  if (!decided) return { ok: false, error_zh: "这份申请已经处理过，或者不存在。" };
  const entry = await addModerationLog({
    action: decision.approve ? "verify_approve" : "verify_reject",
    employerId: pending.employerId,
    employerName: employer?.name ?? pending.tradingName,
    note: decision.approve
      ? `${KIND_LABELS[pending.kind]}，NZBN ${pending.nzbn}`
      : `${REJECT_REASONS[decision.rejection.reason]}：${decision.rejection.note}`,
    moderator: me.email,
  });
  return { ok: true, text: describeAction(entry) };
}

/** Approves an application once every required item of the checklist is ticked; the business gets the badge. */
export async function approveVerification(id: string, checklist: unknown): Promise<AdminResult> {
  return decide(id, checklist, { approve: true });
}

/** Rejects an application with a reason and a note the employer sees; the checklist so far is kept. */
export async function rejectVerification(
  id: string,
  reason: unknown,
  note: unknown,
  checklist: unknown,
): Promise<AdminResult> {
  const rejection = parseRejection(reason, note);
  if (!rejection.ok) return rejection;
  return decide(id, checklist, { approve: false, rejection: rejection.value });
}
