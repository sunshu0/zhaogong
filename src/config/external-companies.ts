// Companies whose public job postings 找工 may show as external jobs (Round 18, #111, ADR 0014). Kept by hand.
// A company is imported only after a person has read the terms of its careers site and of the tracking system's
// public API, written down who checked and when, and found that they allow showing the postings elsewhere with a
// link back. Until then `terms` stays null and the importer skips the company (and takes down anything it had).
//
// The candidates below were found on 2026-10-17 by reading each board's public API once: each has software or
// electrical jobs in New Zealand. Their terms have NOT been checked yet.
import type { ExternalSource } from "@/lib/external-jobs/types";

export interface TermsCheck {
  /** Who read the terms (a person, by name or role). */
  checkedBy: string;
  /** The day they read them, YYYY-MM-DD. */
  checkedOn: string;
  /** Whether the terms allow showing the postings' facts on 找工 with a link to the original. */
  allowsDisplay: boolean;
  /** Which terms were read (links), and anything they ask for. */
  note: string;
}

export interface ExternalCompany {
  /** Stable id, part of each job's id. */
  id: string;
  /** The name shown in 「来自 XX 官网」. */
  name: string;
  source: ExternalSource;
  /** Greenhouse board token, or Lever site name. */
  board: string;
  /** The company's own careers page. */
  careersUrl: string;
  terms: TermsCheck | null;
}

export const EXTERNAL_COMPANIES: ExternalCompany[] = [
  {
    id: "rocketlab",
    name: "Rocket Lab",
    source: "greenhouse",
    board: "rocketlab",
    careersUrl: "https://job-boards.greenhouse.io/rocketlab",
    terms: null,
  },
  {
    id: "dawnaerospace",
    name: "Dawn Aerospace",
    source: "greenhouse",
    board: "dawnaerospace",
    careersUrl: "https://job-boards.greenhouse.io/dawnaerospace",
    terms: null,
  },
  {
    id: "pushpay",
    name: "Pushpay",
    source: "greenhouse",
    board: "pushpay",
    careersUrl: "https://job-boards.greenhouse.io/pushpay",
    terms: null,
  },
  {
    id: "clearpoint",
    name: "ClearPoint",
    source: "lever",
    board: "clearpoint",
    careersUrl: "https://jobs.lever.co/clearpoint",
    terms: null,
  },
  {
    id: "propellerhead",
    name: "Propellerhead",
    source: "lever",
    board: "propellerhead",
    careersUrl: "https://jobs.lever.co/propellerhead",
    terms: null,
  },
  {
    id: "kpmgnz",
    name: "KPMG New Zealand",
    source: "lever",
    board: "kpmgnz",
    careersUrl: "https://jobs.lever.co/kpmgnz",
    terms: null,
  },
  {
    id: "myob",
    name: "MYOB",
    source: "lever",
    board: "myob-2",
    careersUrl: "https://jobs.lever.co/myob-2",
    terms: null,
  },
];

/** Imported only when a person checked the terms and they allow showing the postings. */
export function importAllowed(company: ExternalCompany): boolean {
  return company.terms?.allowsDisplay === true && /^\d{4}-\d{2}-\d{2}$/.test(company.terms.checkedOn);
}

/**
 * Where a company asks for its jobs to be removed (#113, shown under every external job page). Set TAKEDOWN_EMAIL on
 * the server before launch; until then the pages say the address is still to come.
 */
export function takedownEmail(): string | undefined {
  return process.env.TAKEDOWN_EMAIL?.trim() || undefined;
}
