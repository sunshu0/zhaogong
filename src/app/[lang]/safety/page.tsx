import type { Metadata } from "next";
import type { ReactNode } from "react";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/config/countries";
import { Group, Section } from "@/components/ui/Section";
import { formatDate, formatMoney } from "@/i18n/format";
import { safetyMessages } from "@/i18n/messages/safety";
import { messages, serverLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(safetyMessages)).title };
}

const IMMIGRATION_NZ = "https://www.immigration.govt.nz/";
const WHO_CAN_ADVISE = "https://www.iaa.govt.nz/for-migrants/who-can-give-advice/";
const WAGE_RATES =
  "https://www.employment.govt.nz/pay-and-hours/pay-and-wages/minimum-wage/minimum-wage-rates-and-types";

const LINK = "text-brand underline underline-offset-2";

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Section look="app" id={id} title={title}>
      <Group className="space-y-2 text-body">{children}</Group>
    </Section>
  );
}

/**
 * 防骗指南 (S2, #390): the requests most common in job scams, what each is and what to do. The minimum wages come
 * from the country's settings (countries.test.ts fails a year after they took effect).
 */
export default async function SafetyPage() {
  const t = await messages(safetyMessages);
  const lang = await serverLang();
  const wage = COUNTRIES[DEFAULT_COUNTRY].minimumWage;
  return (
    <article aria-labelledby="safety-title" className="type-app space-y-section lg:max-w-3xl">
      <header className="space-y-2 pt-2">
        <h1 id="safety-title" className="text-title font-semibold">
          {t.title}
        </h1>
        <p className="text-body">{t.intro}</p>
      </header>
      <Part id="safety-fees" title={t.fees.heading}>
        <p>{t.fees.body}</p>
      </Part>
      <Part id="safety-visa" title={t.visa.heading}>
        <p>{t.visa.body}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a href={IMMIGRATION_NZ} className={LINK}>
              {t.visa.inz}
            </a>
          </li>
          <li>
            <a href={WHO_CAN_ADVISE} className={LINK}>
              {t.visa.advisers}
            </a>
          </li>
        </ul>
      </Part>
      <Part id="safety-tasks" title={t.tasks.heading}>
        <p>{t.tasks.body}</p>
      </Part>
      <Part id="safety-documents" title={t.documents.heading}>
        <p>{t.documents.body}</p>
      </Part>
      <Part id="safety-wage" title={t.wage.heading}>
        <p>
          {t.wage.body(
            formatMoney(wage.hourly, lang),
            formatMoney(wage.startingOut, lang),
            formatDate(wage.effectiveFrom, lang),
          )}
        </p>
        <p>
          <a href={WAGE_RATES} className={LINK}>
            {t.wage.rates}
          </a>
        </p>
      </Part>
      <p className="px-1 text-meta text-muted">{t.notAdvice}</p>
    </article>
  );
}
