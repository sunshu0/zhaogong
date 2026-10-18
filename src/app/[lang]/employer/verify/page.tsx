import type { Metadata } from "next";
import { VerifyBusiness } from "@/components/employer/VerifyBusiness";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await messages(employerVerifyMessages)).page;
  return { title: t.title, description: t.description };
}

export default function VerifyPage() {
  return <VerifyBusiness />;
}
