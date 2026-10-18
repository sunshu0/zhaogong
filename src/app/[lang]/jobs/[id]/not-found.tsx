import { BriefcaseBusiness } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";
import { messages } from "@/i18n/server";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

export default async function JobNotFound() {
  const t = (await messages(seekerJobsMessages)).notFound;
  return (
    <StatusCard icon={BriefcaseBusiness} title={t.title} actions={<ButtonLink href="/jobs">{t.others}</ButtonLink>}>
      {t.body}
    </StatusCard>
  );
}
