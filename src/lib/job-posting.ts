// schema.org JobPosting for search engines (R-32): what Google for Jobs reads from a job page. Facts only, and
// never the contact details (they are for signed-in users, ADR 0002). Pure, so it can be tested.
import { COUNTRIES, regionById } from "@/config/countries";
import type { EmploymentType, Employer, Job } from "@/lib/types";

const EMPLOYMENT: Record<EmploymentType, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  casual: "TEMPORARY",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The description as the simple HTML JobPosting expects: one paragraph per line, Chinese first, then English. */
function descriptionHtml(job: Job): string {
  return [job.descriptionZh, job.descriptionEn]
    .flatMap((text) => text.split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

export function jobPostingJsonLd(job: Job, employer: Employer, origin: string) {
  const country = COUNTRIES[job.country];
  const region = regionById(job.country, job.regionId);
  const single = job.pay.max == null || job.pay.max === job.pay.min;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.titleZh,
    description: descriptionHtml(job),
    identifier: { "@type": "PropertyValue", name: employer.name, value: job.id },
    url: `${origin}/jobs/${job.id}`,
    datePosted: job.postedAt,
    validThrough: job.expiresAt,
    employmentType: [...new Set(job.employmentType.map((t) => EMPLOYMENT[t]))],
    hiringOrganization: { "@type": "Organization", name: employer.name, sameAs: `${origin}/employers/${employer.id}` },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.address ? { streetAddress: job.address } : {}),
        addressLocality: region?.nameEn,
        addressRegion: region?.area,
        addressCountry: job.country,
      },
    },
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: country.currency,
      value: single
        ? { "@type": "QuantitativeValue", value: job.pay.min, unitText: "HOUR" }
        : { "@type": "QuantitativeValue", minValue: job.pay.min, maxValue: job.pay.max, unitText: "HOUR" },
    },
  };
}

/**
 * The JSON for a <script type="application/ld+json">. "<" is written as \u003c so text in a job (for example
 * "</script>") cannot end the script early; JSON readers decode it back.
 */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
