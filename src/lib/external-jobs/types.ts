// External jobs (Round 18, #111, ADR 0014): postings read from a company's applicant-tracking system through its
// official public API, kept as facts only. The posting's own text is read during the import to find these facts and
// is never stored or shown (ADR 0014 rule 2).

/** The applicant-tracking systems the importer reads. */
export type ExternalSource = "greenhouse" | "lever";

/** The two fields of the pilot (user, 2026-10-17): software, and electrical and electronic engineering. */
export type ExternalField = "software" | "electrical";

/** What the posting says the job is; null when it does not say. 实习 = internship and graduate, the rest 专业职位. */
export type ExternalKind = "internship" | "graduate" | "full_time" | "part_time" | "contract";

/** Cities the filters know; other places in New Zealand are "nz_other". */
export type ExternalCity = "auckland" | "wellington" | "christchurch" | "hamilton" | "dunedin" | "nz_other";

/**
 * What the posting itself says about who may work there. An empty list means the posting does not say
 * (「原文未说明」) — nothing is guessed (ADR 0014 rule 3).
 */
export type VisaFact = "citizen_or_resident" | "work_rights" | "sponsorship" | "no_sponsorship";

export type DegreeLevel = "bachelor" | "master" | "phd";

export type DegreeSubject =
  | "computer_science"
  | "software_engineering"
  | "computer_engineering"
  | "electrical_engineering"
  | "electronic_engineering"
  | "mechatronics"
  | "information_technology"
  | "mathematics"
  | "physics";

export type PayPeriod = "year" | "month" | "hour";

/** Pay, only when the posting states it. */
export interface ExternalPay {
  minCents: number;
  maxCents?: number;
  currency: string;
  period: PayPeriod;
}

/**
 * Things a moderator must look at before showing the job (#112): a requirement about citizenship of another country
 * (export-control roles ask for "U.S. person"), or about race or ethnicity. Equal-opportunity statements are not
 * flagged.
 */
export type ExternalFlag = "other_citizenship" | "ethnicity";

/** One posting as the API gives it, before facts are taken from it. `text` is the posting's text, never stored. */
export interface RawPosting {
  externalId: string;
  title: string;
  /** Location names as the posting gives them, most specific first. */
  locations: string[];
  /** ISO 3166 country code when the API gives one (Lever). */
  country?: string;
  /** Departments or teams, used to place a generic title like "Graduate Engineer". */
  departments: string[];
  /** Lever's commitment ("Full-time", "Internship", "Fixed Term"…). */
  commitment?: string;
  /** The posting page on the company's careers site or its tracking system. */
  url: string;
  postedAt?: string;
  /** The deadline when the API has a field for it (Greenhouse). */
  deadline?: string;
  /** Pay when the API has a field for it. */
  pay?: ExternalPay;
  /** Plain text of the posting. Read once to find the facts; never stored. */
  text: string;
}

/** The facts the platform keeps about an external job (ADR 0014 rule 1). */
export interface ExternalFacts {
  externalId: string;
  title: string;
  location: string;
  city: ExternalCity;
  field: ExternalField;
  kind: ExternalKind | null;
  /** End of the closing day, ISO; null when the posting gives no date. */
  closesAt: string | null;
  minYears: number | null;
  degree: DegreeLevel | null;
  degreeSubjects: DegreeSubject[];
  visa: VisaFact[];
  pay: ExternalPay | null;
  url: string;
  postedAt: string | null;
  flags: ExternalFlag[];
}
