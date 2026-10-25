import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/config/countries";
import { Group, Section } from "@/components/ui/Section";
import { formatDate, formatMoney } from "@/i18n/format";
import { aboutMessages } from "@/i18n/messages/about";
import { messages, serverLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(aboutMessages)).title };
}

const IMMIGRATION_NZ = "https://www.immigration.govt.nz/";
const WHO_CAN_ADVISE = "https://www.iaa.govt.nz/for-migrants/who-can-give-advice/";

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Section look="sheet" id={id} title={title}>
      <Group className="space-y-2 text-body">{children}</Group>
    </Section>
  );
}

/**
 * 关于找工 (#324): who runs it, who it is for, what it costs, the rules every job keeps, visas, external jobs, your
 * information and how to reach us. The minimum wage comes from the country's settings, so the page never goes stale.
 */
export default async function AboutPage() {
  const t = await messages(aboutMessages);
  const lang = await serverLang();
  const wage = COUNTRIES[DEFAULT_COUNTRY].minimumWage;
  return (
    <article aria-labelledby="about-title" className="type-app space-y-section lg:max-w-3xl">
      <header className="space-y-2 pt-2">
        <h1 id="about-title" className="text-title font-semibold">
          {t.title}
        </h1>
        <p className="text-body">{t.intro}</p>
      </header>
      <Part id="about-who" title={t.who.heading}>
        <p>{t.who.body}</p>
      </Part>
      <Part id="about-cost" title={t.cost.heading}>
        <p>{t.cost.body}</p>
      </Part>
      <Part id="about-rules" title={t.rules.heading}>
        <p>{t.rules.intro}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t.rules.wage(formatMoney(wage.hourly, lang), formatDate(wage.effectiveFrom, lang))}</li>
          <li>{t.rules.noFees}</li>
          <li>{t.rules.noDiscrimination}</li>
        </ul>
        <p>{t.rules.report}</p>
      </Part>
      <Part id="about-visa" title={t.visa.heading}>
        <p>{t.visa.body}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a href={IMMIGRATION_NZ} className="text-brand underline underline-offset-2">
              {t.visa.inz}
            </a>
          </li>
          <li>
            <a href={WHO_CAN_ADVISE} className="text-brand underline underline-offset-2">
              {t.visa.advisers}
            </a>
          </li>
        </ul>
      </Part>
      <Part id="about-external" title={t.external.heading}>
        <p>{t.external.body}</p>
      </Part>
      <Part id="about-data" title={t.data.heading}>
        <p>{t.data.body}</p>
        <p>
          <Link href="/privacy" className="text-brand underline underline-offset-2">
            {t.data.privacy}
          </Link>
        </p>
      </Part>
      <Part id="about-contact" title={t.contact.heading}>
        <p>{t.contact.body}</p>
      </Part>
    </article>
  );
}
