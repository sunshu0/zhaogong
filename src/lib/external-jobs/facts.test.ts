import { describe, expect, it } from "vitest";
import {
  closesAtOf,
  degreeOf,
  endOfNzDay,
  factsOf,
  fieldOf,
  flagsOf,
  htmlToText,
  kindOf,
  minYearsOf,
  nzCity,
  payOf,
  placedByTitle,
  visaOf,
} from "@/lib/external-jobs/facts";
import type { RawPosting } from "@/lib/external-jobs/types";

const NOW = new Date("2026-10-17T01:00:00.000Z");

describe("external job facts (#111)", () => {
  it("reads HTML as plain text, entities included (Greenhouse sends its HTML escaped once more)", () => {
    expect(htmlToText("<p>Build &amp; ship</p><ul><li>Rust</li><li>C&#43;&#43;</li></ul>")).toBe(
      "Build & ship\nRust\nC++",
    );
    expect(htmlToText("&lt;p&gt;Hi&lt;/p&gt;")).toBe("<p>Hi</p>");
  });

  it("keeps jobs in New Zealand only, with the city when it is one the filters know", () => {
    expect(nzCity(["Auckland, New Zealand"])).toBe("auckland");
    expect(nzCity(["Christchurch, Canterbury, New Zealand"])).toBe("christchurch");
    expect(nzCity(["Lower Hutt"])).toBe("wellington");
    expect(nzCity(["Tauranga"])).toBe("nz_other");
    expect(nzCity(["Remote"], "NZ")).toBe("nz_other");
    expect(nzCity(["Remote"])).toBeNull();
    expect(nzCity(["Sydney, Australia"])).toBeNull();
    expect(nzCity(["Delft, South Holland, Netherlands"], "NL")).toBeNull();
  });

  it("takes only software and electrical work; a generic title is placed by its department", () => {
    expect(fieldOf("Senior Software Engineer", [])).toBe("software");
    expect(fieldOf("Full Stack Developer", [])).toBe("software");
    expect(fieldOf("Electronics Engineer", [])).toBe("electrical");
    expect(fieldOf("Embedded Software Engineer", [])).toBe("electrical");
    expect(fieldOf("Graduate Engineer", ["Avionics"])).toBe("electrical");
    expect(fieldOf("Summer Intern", ["Software Development"])).toBe("software");
    expect(fieldOf("Graduate Engineer", ["Structures"])).toBeNull();
    expect(fieldOf("Mechanical Design Engineer", [])).toBeNull();
    expect(fieldOf("Avionics Technician", [])).toBeNull();
    expect(fieldOf("Software Sales Account Executive", [])).toBeNull();
    expect(fieldOf("Marketing Manager", ["Software"])).toBeNull();
    expect(fieldOf("R&D Mechanical Engineer", ["Avionics"])).toBeNull();
    expect(fieldOf("CNC Programmer", ["Manufacturing"])).toBeNull();
  });

  it("on an Ashby board, a generic title in a department named only Engineering is software (#180)", () => {
    // Xero's Ashby board, 2026-10-17: these four were dropped for their generic titles.
    expect(fieldOf("Engineering Manager", ["Engineering"], "ashby")).toBe("software");
    expect(fieldOf("Senior Engineer - Database", ["Engineering", "Database"], "ashby")).toBe("software");
    expect(fieldOf("Senior Security Engineer", [" Engineering "], "ashby")).toBe("software");
    expect(fieldOf("Summer Intern", ["Engineering"], "ashby")).toBe("software");
    // A department or team that names the field still decides first.
    expect(fieldOf("Graduate Engineer", ["Engineering", "Avionics"], "ashby")).toBe("electrical");
    // Not software: other sources, the words that rule a title out, other departments, a title that is not generic.
    expect(fieldOf("Graduate Engineer", ["Engineering"], "greenhouse")).toBeNull();
    expect(fieldOf("Graduate Engineer", ["Engineering"], "lever")).toBeNull();
    expect(fieldOf("Graduate Engineer", ["Engineering"])).toBeNull();
    expect(fieldOf("Experienced Mechanical Engineer", ["Engineering"], "ashby")).toBeNull();
    expect(fieldOf("Sales Engineer (Enterprise)", ["Engineering"], "ashby")).toBeNull();
    // Halter's board: hardware has its own department there.
    expect(fieldOf("Senior Failure Analysis Engineer", ["Hardware", "Hardware Reliability"], "ashby")).toBeNull();
    expect(fieldOf("Engineering Manager", ["Product & Engineering"], "ashby")).toBeNull();
    expect(fieldOf("Office Manager", ["Engineering"], "ashby")).toBeNull();
  });

  it("knows a field placed by the title from one placed by the department, for the moderator (#191)", () => {
    expect(placedByTitle("Senior Software Engineer", "greenhouse")).toBe(true);
    expect(placedByTitle("Embedded Software Engineer", "lever")).toBe(true);
    expect(placedByTitle("Electronics Engineer", "ashby")).toBe(true);
    expect(placedByTitle("Graduate Engineer", "greenhouse")).toBe(false);
    expect(placedByTitle("Summer Intern", "lever")).toBe(false);
    expect(placedByTitle("Engineering Manager", "ashby")).toBe(false);
    expect(placedByTitle("Senior Engineer - Database", "ashby")).toBe(false);
  });

  it("counts Developer only when it is the job, not the people a role serves; product roles are not engineering (#180)", () => {
    // Partly's Ashby board, 2026-10-17: a product manager was taken for software.
    expect(
      fieldOf("Senior/Staff Product Manager, NZ, Infrastructure APIs & Developer Ecosystem", ["Product"], "ashby"),
    ).toBeNull();
    expect(fieldOf("Developer Relations Lead", ["Engineering"], "ashby")).toBeNull();
    expect(fieldOf("Developer Advocate", ["Software"])).toBeNull();
    expect(fieldOf("Technical Product Manager, Software Platform", [])).toBeNull();
    expect(fieldOf("Product Owner - Developer Tools", ["Software Engineering"], "ashby")).toBeNull();
    expect(fieldOf("Principal Product Designer", ["Product", "Product Design"], "ashby")).toBeNull();
    expect(fieldOf("Business Developer", [])).toBeNull();
    // Still developers: Halter's, Electric Kiwi's (Greenhouse) and Partly's.
    expect(fieldOf("NetSuite Developer", ["General & Admin", "Finance Systems"], "ashby")).toBe("software");
    expect(fieldOf("Developer Productivity Engineer", [], "greenhouse")).toBe("software");
    expect(fieldOf("Full Stack Developer", ["Engineering", "Product"], "lever")).toBe("software");
    expect(fieldOf("Intern/ Graduate Software Engineer, NZ", ["AI Research & Software Engineering"], "ashby")).toBe(
      "software",
    );
  });

  it("says internship or graduate from the title first, then what the commitment or the text says, else nothing", () => {
    expect(kindOf("Software Engineering Intern", "Full-time", "")).toBe("internship");
    expect(kindOf("Graduate Electrical Engineer 2027", undefined, "")).toBe("graduate");
    expect(kindOf("Data Engineer", "Fixed Term", "")).toBe("contract");
    expect(kindOf("Developer", "Part-time", "")).toBe("part_time");
    expect(kindOf("Developer", "Permanent", "")).toBe("full_time");
    expect(kindOf("Developer", undefined, "This is a 12-month contract based in Auckland.")).toBe("contract");
    expect(kindOf("Developer", undefined, "A full-time role in our Wellington office.")).toBe("full_time");
    expect(kindOf("Developer", undefined, "Join our team.")).toBeNull();
  });

  it("reads the years of experience asked for, the lowest when several are named", () => {
    expect(minYearsOf("You have 5+ years of experience in TypeScript.")).toBe(5);
    expect(minYearsOf("3-5 years' experience with embedded C. Ideally 7 years experience leading teams.")).toBe(3);
    expect(minYearsOf("We have been around for 20 years.")).toBeNull();
    expect(minYearsOf("Experience with Rust is a plus.")).toBeNull();
  });

  it("reads the lowest degree named and the subjects in the same sentence", () => {
    expect(degreeOf("A Bachelor's or Master's degree in Electrical Engineering or Computer Science.")).toEqual({
      degree: "bachelor",
      subjects: ["computer_science", "electrical_engineering"],
    });
    expect(degreeOf("PhD in physics preferred.")).toEqual({ degree: "phd", subjects: ["physics"] });
    expect(degreeOf("Bachelor’s degree or higher in Electrical Engineering, Mechatronics, or related field")).toEqual({
      degree: "bachelor",
      subjects: ["electrical_engineering", "mechatronics"],
    });
    expect(degreeOf("Master’s in Software Engineering.").degree).toBe("master");
    expect(degreeOf("Strong maths skills.")).toEqual({ degree: null, subjects: [] });
  });

  it("states only what the posting says about visas; nothing said is an empty list (原文未说明)", () => {
    expect(visaOf("You must be a New Zealand citizen or permanent resident.")).toEqual(["citizen_or_resident"]);
    expect(visaOf("Applicants must have the right to work in New Zealand.")).toEqual(["work_rights"]);
    expect(visaOf("We are unable to offer visa sponsorship for this role.")).toEqual(["no_sponsorship"]);
    expect(visaOf("Visa sponsorship is not available.")).toEqual(["no_sponsorship"]);
    expect(visaOf("Visa sponsorship is available for the right candidate.")).toEqual(["sponsorship"]);
    expect(visaOf("We build rockets. Apply now.")).toEqual([]);
  });

  it("flags requirements about other citizenships or ethnicity, but not equal-opportunity statements", () => {
    expect(flagsOf("This role requires U.S. person status under ITAR.")).toEqual(["other_citizenship"]);
    expect(flagsOf("Candidates must be of Asian ethnicity.")).toEqual(["ethnicity"]);
    expect(flagsOf("We do not discriminate on the basis of race, ethnicity or nationality.")).toEqual([]);
    expect(flagsOf("We encourage Māori and Pasifika applicants of every ethnic background.")).toEqual([]);
    expect(flagsOf("You must be a New Zealand citizen or resident.")).toEqual([]);
  });

  it("reads pay only from a sentence about pay, with its period", () => {
    expect(payOf("The salary range is $95,000 – $110,000 per annum.")).toEqual({
      minCents: 95_000_00,
      maxCents: 110_000_00,
      currency: "NZD",
      period: "year",
    });
    expect(payOf("Interns are paid $32 per hour.")).toEqual({ minCents: 32_00, currency: "NZD", period: "hour" });
    expect(payOf("Base pay from $120k.")).toEqual({ minCents: 120_000_00, currency: "NZD", period: "year" });
    expect(payOf("We raised $40 million last year.")).toBeNull();
    expect(payOf("A package of $25 plus snacks.")).toBeNull();
  });

  it("gives the closing date as the end of that day in New Zealand", () => {
    expect(endOfNzDay(2026, 11, 20)).toBe("2026-11-20T10:59:59.000Z"); // NZDT, +13
    expect(endOfNzDay(2026, 6, 1)).toBe("2026-06-01T11:59:59.000Z"); // NZST, +12
    expect(closesAtOf("Applications close 20 November 2026.", NOW)).toBe("2026-11-20T10:59:59.000Z");
    expect(closesAtOf("Closing date: 20/11/2026", NOW)).toBe("2026-11-20T10:59:59.000Z");
    expect(closesAtOf("Apply by March 3rd.", NOW)).toBe("2027-03-03T10:59:59.000Z");
    expect(closesAtOf("Applications close on the 10th of October.", NOW)).toBe("2026-10-10T10:59:59.000Z");
    expect(closesAtOf("We were founded on 1 May 2019.", NOW)).toBeNull();
  });

  it("puts the facts together and drops jobs outside the pilot", () => {
    const posting: RawPosting = {
      externalId: "42",
      source: "greenhouse",
      title: "  Graduate   Software Engineer ",
      locations: ["Auckland, New Zealand"],
      departments: ["Engineering"],
      url: "https://example.com/jobs/42",
      text: "Applications close 20 November 2026.\nA bachelor's degree in Software Engineering.",
    };
    expect(factsOf(posting, NOW)).toEqual({
      externalId: "42",
      title: "Graduate Software Engineer",
      location: "Auckland, New Zealand",
      city: "auckland",
      field: "software",
      kind: "graduate",
      closesAt: "2026-11-20T10:59:59.000Z",
      minYears: null,
      degree: "bachelor",
      degreeSubjects: ["software_engineering"],
      visa: [],
      pay: null,
      url: "https://example.com/jobs/42",
      postedAt: null,
      flags: [],
    });
    expect(factsOf({ ...posting, deadline: "2026-12-01T00:00:00Z" }, NOW)?.closesAt).toBe("2026-12-01T00:00:00.000Z");
    expect(factsOf({ ...posting, locations: ["Melbourne"] }, NOW)).toBeNull();
    expect(factsOf({ ...posting, title: "Office Manager" }, NOW)).toBeNull();
    // The posting's source reaches fieldOf (#180).
    const generic = { ...posting, title: "Graduate Engineer" };
    expect(factsOf({ ...generic, source: "ashby" }, NOW)?.field).toBe("software");
    expect(factsOf(generic, NOW)).toBeNull();
  });
});
