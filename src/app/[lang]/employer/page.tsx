import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { LinkList } from "@/components/ui/LinkList";
import { Section } from "@/components/ui/Section";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await messages(employerCommonMessages)).home;
  return { title: t.title, description: t.description };
}

export default async function EmployerHome() {
  const t = (await messages(employerCommonMessages)).home;
  return (
    <div className="space-y-section">
      <section className="space-y-4 py-2">
        <h1 className="text-title font-semibold">{t.heading}</h1>
        <ul className="space-y-2">
          {t.points.map((point) => (
            <li key={point} className="flex gap-2 text-body">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
              {point}
            </li>
          ))}
        </ul>
        <div>
          <ButtonLink href="/employer/post" block size="lg">
            {t.cta}
          </ButtonLink>
          <p className="mt-2 text-center text-meta text-muted">{t.ctaNote}</p>
        </div>
      </section>

      <Section look="sheet">
        <LinkList
          label={t.linksLabel}
          items={[
            { href: "/employer/jobs", label: t.jobsLink, detail: t.jobsDetail },
            { href: "/employer/verify", label: t.verifyLink, detail: t.verifyDetail },
          ]}
        />
      </Section>
    </div>
  );
}
