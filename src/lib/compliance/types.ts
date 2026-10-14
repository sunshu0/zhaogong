import type { EmployerVerification, Job } from "@/lib/types";

/** A job being written by an employer: any field may still be missing. */
export type JobDraft = Partial<Omit<Job, "id" | "status" | "postedAt" | "expiresAt">>;

/**
 * block: cannot be published as it is (illegal or plainly against the rules).
 * rewrite: the wording has to change; the message says how.
 * review: may be published, but a person checks it before it goes live.
 */
export type FindingLevel = "block" | "rewrite" | "review";

export type RuleId = "min_wage" | "fee" | "visa_selling" | "ethnic_preference" | "high_risk" | "aewv_unaccredited";

/** What the check needs to know about who posts the job. Leave it out where the employer is not known. */
export interface PostingEmployer {
  verification: EmployerVerification;
}

/** A word rule that matched in a chat message. Chats only look for fees, visa selling and ethnic preference. */
export interface ChatFinding {
  rule: Extract<RuleId, "fee" | "visa_selling" | "ethnic_preference">;
  /** Words that triggered the rule, in the order they appear. */
  matches: string[];
}

export interface Finding {
  level: FindingLevel;
  field: keyof JobDraft;
  message_zh: string;
  rule: RuleId;
  /** Words that triggered a word rule, in the order they appear. */
  matches?: string[];
}
