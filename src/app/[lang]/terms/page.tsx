import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalTermsMessages } from "@/i18n/messages/legal-terms";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(legalTermsMessages);
  return { title: t.title, description: t.description };
}

// #323: /terms, in the page's language (the words, and what they are checked against, are in legal-terms.ts).
export default async function TermsPage() {
  return <LegalPage words={await messages(legalTermsMessages)} />;
}
