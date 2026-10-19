import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalPrivacyMessages } from "@/i18n/messages/legal-privacy";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(legalPrivacyMessages);
  return { title: t.title, description: t.description };
}

// #323: /privacy, in the page's language (the words, and what they are checked against, are in legal-privacy.ts).
export default async function PrivacyPage() {
  return <LegalPage words={await messages(legalPrivacyMessages)} />;
}
