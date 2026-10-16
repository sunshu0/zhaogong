// Facts from one posting (#111, ADR 0014). Pure: the importer hands in a RawPosting, gets ExternalFacts back or
// null when the job is outside the pilot (not in New Zealand, or not software or electrical work). Only what the
// posting states is kept; anything it does not state stays null or empty, shown as 「原文未说明」.
import type {
  DegreeLevel,
  DegreeSubject,
  ExternalCity,
  ExternalFacts,
  ExternalField,
  ExternalFlag,
  ExternalKind,
  ExternalPay,
  PayPeriod,
  RawPosting,
  VisaFact,
} from "@/lib/external-jobs/types";

// ---- text ----

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML entities decoded (named ones above, and numeric ones). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** Plain text of an HTML fragment: block ends become line breaks, tags go, entities are decoded. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Sentences and list lines, for rules that must not read across two of them. */
function sentences(text: string): string[] {
  return text
    .split(/\n|(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- where ----

const CITIES: [RegExp, ExternalCity][] = [
  [/\bauckland\b|tāmaki makaurau/i, "auckland"],
  [/\bwellington\b|te whanganui-a-tara|lower hutt|upper hutt|porirua/i, "wellington"],
  [/\bchristchurch\b|ōtautahi|otautahi/i, "christchurch"],
  [/\bhamilton\b|kirikiriroa/i, "hamilton"],
  [/\bdunedin\b|ōtepoti/i, "dunedin"],
];

const NZ =
  /new zealand|aotearoa|\bnz\b|\bnzl\b|tauranga|palmerston north|nelson|queenstown|napier|hastings|new plymouth|whangārei|whangarei|invercargill|rotorua|\btimaru\b/i;

/** The New Zealand city of the job, or null when the job is not in New Zealand (or the posting does not say). */
export function nzCity(locations: string[], country?: string): ExternalCity | null {
  for (const name of locations) {
    for (const [re, city] of CITIES) if (re.test(name)) return city;
  }
  if (country?.toUpperCase() === "NZ") return "nz_other";
  return locations.some((name) => NZ.test(name)) ? "nz_other" : null;
}

// ---- field ----

const NOT_ENGINEERING =
  /technician|technicus|machinist|\bcnc\b|mechanical|civil|structural|chemical|propulsion|manufacturing|materials|composites|\bsales\b|marketing|recruit|account (executive|manager)|customer success|business development|coordinator|\bbuyer\b|procurement/i;
const ELECTRICAL =
  /electrical|electronic|avionics|\bpcb\b|\brf\b|fpga|\basic\b|power electronics|hardware (design |development )?engineer|firmware|embedded|circuit|电气|电子/i;
const SOFTWARE =
  /software|developer|full[ -]?stack|front[ -]?end|back[ -]?end|devops|\bsre\b|site reliability|platform engineer|cloud engineer|mobile engineer|\bios\b|android|web engineer|data engineer|machine learning engineer|\bml engineer|test automation|automation engineer|\bqa engineer|软件|开发/i;
const GENERIC = /engineer|developer|intern|graduate|工程师|实习/i;

/**
 * Software or electrical, from the title; a generic title ("Graduate Engineer", "Summer Intern") is placed by its
 * department. Electrical wins over software for firmware and embedded work. Null: outside the pilot.
 */
export function fieldOf(title: string, departments: string[]): ExternalField | null {
  if (NOT_ENGINEERING.test(title)) return null;
  if (ELECTRICAL.test(title)) return "electrical";
  if (SOFTWARE.test(title)) return "software";
  if (!GENERIC.test(title)) return null;
  const dept = departments.join(" / ");
  if (ELECTRICAL.test(dept)) return "electrical";
  if (SOFTWARE.test(dept)) return "software";
  return null;
}

// ---- kind ----

/** What the title, the commitment field or the text says the job is; null when none of them says. */
export function kindOf(title: string, commitment: string | undefined, text: string): ExternalKind | null {
  if (/\bintern(ship)?s?\b|summer (student|scholar)|\bco-?op\b|实习/i.test(title)) return "internship";
  if (/\bgraduate\b|\bgrad\b|early careers? programme|毕业生/i.test(title)) return "graduate";
  const c = commitment ?? "";
  if (/intern/i.test(c)) return "internship";
  if (/graduate/i.test(c)) return "graduate";
  if (/contract|fixed[- ]?term|temporary/i.test(c) || /\bcontract(or)?\b|fixed[- ]?term/i.test(title))
    return "contract";
  if (/part[- ]?time/i.test(c) || /part[- ]?time/i.test(title)) return "part_time";
  if (/full[- ]?time|permanent/i.test(c)) return "full_time";
  if (/fixed[- ]?term (contract|role|position)|\b\d+[- ]month contract\b/i.test(text)) return "contract";
  if (/\bfull[- ]?time\b|\bpermanent (full[- ]?time )?(role|position)\b/i.test(text)) return "full_time";
  if (/\bpart[- ]?time (role|position)\b/i.test(text)) return "part_time";
  return null;
}

// ---- requirements ----

/** The smallest number of years of experience a sentence about experience asks for. */
export function minYearsOf(text: string): number | null {
  let min: number | null = null;
  for (const s of sentences(text)) {
    if (!/experience|经验/i.test(s)) continue;
    for (const m of s.matchAll(/(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?\+?\s*(?:years?|yrs?|年)/gi)) {
      const n = Number(m[1]);
      if (n <= 30) min = min == null ? n : Math.min(min, n);
    }
  }
  return min;
}

const SUBJECTS: [RegExp, DegreeSubject][] = [
  [/computer science/i, "computer_science"],
  [/software engineering/i, "software_engineering"],
  [/computer (systems )?engineering/i, "computer_engineering"],
  [/electrical (and electronic )?engineering|electrical/i, "electrical_engineering"],
  [/electronics?( engineering)?/i, "electronic_engineering"],
  [/mechatronic/i, "mechatronics"],
  [/information technology|\bIT\b/, "information_technology"],
  [/mathematics|\bmaths?\b/i, "mathematics"],
  [/physics/i, "physics"],
];

/** The lowest degree a sentence about qualifications names, and the subjects named in those sentences. */
export function degreeOf(text: string): { degree: DegreeLevel | null; subjects: DegreeSubject[] } {
  const levels: DegreeLevel[] = [];
  const subjects = new Set<DegreeSubject>();
  for (const s of sentences(text)) {
    const found: DegreeLevel[] = [];
    if (
      /bachelor|undergraduate degree|tertiary degree|\bdegree in\b|本科|学士/i.test(s) ||
      /\bB\.?(Sc|E|Eng|Tech)\b/.test(s)
    ) {
      found.push("bachelor");
    }
    if (/master['’]?s\b|硕士/i.test(s) || /\bM\.?(Sc|E|Eng)\b/.test(s)) found.push("master");
    if (/\bph\.?d\b|doctorate|博士/i.test(s)) found.push("phd");
    if (found.length === 0) continue;
    levels.push(...found);
    for (const [re, subject] of SUBJECTS) if (re.test(s)) subjects.add(subject);
  }
  const order: DegreeLevel[] = ["bachelor", "master", "phd"];
  const degree = order.find((level) => levels.includes(level)) ?? null;
  return { degree, subjects: SUBJECTS.map(([, s]) => s).filter((s) => subjects.has(s)) };
}

const NO_SPONSORSHIP =
  /(unable|not able|cannot|can'?t|won'?t|will not|do not|don'?t|does not|are not in a position) (to )?(offer |provide |support )?(visa )?sponsor|sponsorship (is )?not (available|offered|provided)|\bno (visa )?sponsorship\b|without (visa )?sponsorship/i;
const SPONSORSHIP =
  /(visa )?sponsorship (is )?(available|offered|provided)|(we|can|will) (can |will )?(offer |provide )?(visa )?sponsor|support (your|with) (a |the )?(work )?visa/i;
const CITIZEN_OR_RESIDENT =
  /(new zealand|nz|australian)[^.]{0,40}(citizen|citizenship)[^.]{0,40}resident|citizens? (or|and|\/) (permanent )?residents?/i;
const WORK_RIGHTS =
  /(right|rights|eligib\w*|entitle\w*|legally (able|entitled)|authori[sz]ed) to work in (new zealand|nz|aotearoa)|valid (new zealand |nz )?work visa|work rights in (new zealand|nz)/i;

/** What the posting states about citizenship, work rights and sponsorship; empty when it states nothing. */
export function visaOf(text: string): VisaFact[] {
  const facts = new Set<VisaFact>();
  for (const s of sentences(text)) {
    if (NO_SPONSORSHIP.test(s)) facts.add("no_sponsorship");
    else if (SPONSORSHIP.test(s)) facts.add("sponsorship");
    if (CITIZEN_OR_RESIDENT.test(s)) facts.add("citizen_or_resident");
    if (WORK_RIGHTS.test(s)) facts.add("work_rights");
  }
  const order: VisaFact[] = ["citizen_or_resident", "work_rights", "sponsorship", "no_sponsorship"];
  return order.filter((f) => facts.has(f));
}

/** Sentences that only say who is welcome or that nobody is excluded; never flagged. */
const EQUAL_OPPORTUNITY =
  /discriminat|regardless of|without regard|equal (employment )?opportunit|\bEEO\b|encourage|welcome|diverse|diversity|inclusive|inclusion|all backgrounds/i;
const OTHER_CITIZENSHIP =
  /\bU\.?S\.? (citizen|person|national)|\bUS citizenship|\bITAR\b|export control|(chinese|indian|american|british|european|canadian|singapor\w+) (citizens?|nationals?|passport)|nationality/i;
const ETHNICITY =
  /\brace\b|ethnic|caucasian|\bwhite (person|candidates?)\b|\basian (person|candidates?)\b|种族|民族|国籍/i;

/** Requirements a moderator must look at (#112); equal-opportunity statements are not flagged. */
export function flagsOf(text: string): ExternalFlag[] {
  const flags = new Set<ExternalFlag>();
  for (const s of sentences(text)) {
    if (EQUAL_OPPORTUNITY.test(s)) continue;
    if (OTHER_CITIZENSHIP.test(s)) flags.add("other_citizenship");
    if (ETHNICITY.test(s)) flags.add("ethnicity");
  }
  return (["other_citizenship", "ethnicity"] as const).filter((f) => flags.has(f));
}

// ---- pay ----

function amountCents(raw: string): number {
  const k = /k$/i.test(raw);
  const n = Number(raw.replace(/[k,\s]/gi, ""));
  return Math.round(n * (k ? 1000 : 1) * 100);
}

/** Pay stated in a sentence about pay ("$95,000 – $110,000 per annum", "$32 per hour"); null when none is. */
export function payOf(text: string): ExternalPay | null {
  for (const s of sentences(text)) {
    if (!/salary|pay\b|remuneration|package|per annum|p\.a\.|per hour|an hour|\/hr|hourly|base|薪|工资/i.test(s)) {
      continue;
    }
    const m = s.match(
      /(NZ)?\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k?)\s*(?:(?:-|–|to)\s*(?:NZ)?\$?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k?))?/i,
    );
    if (!m) continue;
    const min = amountCents(m[2]);
    const max = m[3] ? amountCents(m[3]) : undefined;
    const hourly = /per hour|an hour|\/hr|hourly|时薪/i.test(s);
    const monthly = /per month|monthly|月薪/i.test(s);
    // A small amount with no period could be an hourly rate or anything else; calling it a year's pay is a guess.
    if (!hourly && !monthly && min < 500_00) continue;
    const period: PayPeriod = hourly ? "hour" : monthly ? "month" : "year";
    return { minCents: min, ...(max != null && max > min && { maxCents: max }), currency: "NZD", period };
  }
  return null;
}

// ---- closing date ----

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The UTC instant at the end (23:59:59) of a calendar day in New Zealand. */
export function endOfNzDay(year: number, month: number, day: number): string {
  const guess = Date.UTC(year, month - 1, day, 23, 59, 59);
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess - (shown - guess)).toISOString();
}

/**
 * The closing date a sentence about closing gives ("Applications close 20 November 2026", "closing date: 20/11/2026"),
 * as the end of that day in New Zealand. Without a year: the next such date on or after `now`, allowing 30 days
 * back (a date just gone means the job has closed).
 */
export function closesAtOf(text: string, now: Date): string | null {
  for (const s of sentences(text)) {
    if (!/clos(e|es|ing)|deadline|apply by|applications? (are )?due|截止/i.test(s)) continue;
    let y: number | undefined, mo: number | undefined, d: number | undefined;
    const named = s.match(
      /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/i,
    );
    const us = s.match(
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i,
    );
    const numeric = s.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
    const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    else if (numeric) [d, mo, y] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
    else if (named)
      [d, mo, y] = [Number(named[1]), MONTHS.indexOf(named[2].toLowerCase()) + 1, Number(named[3]) || undefined];
    else if (us) [mo, d, y] = [MONTHS.indexOf(us[1].toLowerCase()) + 1, Number(us[2]), Number(us[3]) || undefined];
    if (!mo || !d || mo > 12 || d > 31) continue;
    if (y == null) {
      y = now.getUTCFullYear();
      if (Date.parse(endOfNzDay(y, mo, d)) < now.getTime() - 30 * 86_400_000) y += 1;
    }
    return endOfNzDay(y, mo, d);
  }
  return null;
}

// ---- all together ----

/** The facts of a posting, or null when it is outside the pilot (not in New Zealand, not software or electrical). */
export function factsOf(posting: RawPosting, now: Date): ExternalFacts | null {
  const city = nzCity(posting.locations, posting.country);
  if (!city) return null;
  const field = fieldOf(posting.title, posting.departments);
  if (!field) return null;
  const { degree, subjects } = degreeOf(posting.text);
  const deadline = posting.deadline ? Date.parse(posting.deadline) : NaN;
  return {
    externalId: posting.externalId,
    title: posting.title.trim().replace(/\s+/g, " "),
    location: posting.locations[0] ?? "New Zealand",
    city,
    field,
    kind: kindOf(posting.title, posting.commitment, posting.text),
    closesAt: Number.isFinite(deadline) ? new Date(deadline).toISOString() : closesAtOf(posting.text, now),
    minYears: minYearsOf(posting.text),
    degree,
    degreeSubjects: subjects,
    visa: visaOf(posting.text),
    pay: posting.pay ?? payOf(posting.text),
    url: posting.url,
    postedAt: posting.postedAt ?? null,
    flags: flagsOf(`${posting.title}\n${posting.text}`),
  };
}
