import type { Metadata } from "next";
import { TeamPage } from "@/components/employer/TeamPage";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await messages(employerTeamMessages)).teamRoute;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default function EmployerTeamPage() {
  return <TeamPage />;
}
