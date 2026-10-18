import { FileText } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";
import { messages } from "@/i18n/server";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

// Round 19 walk: the same card as a job's or an employer's 404 (#161).
export default async function SharedResumeNotFound() {
  const t = (await messages(seekerProfileMessages)).resume;
  return (
    <StatusCard icon={FileText} title={t.linkClosed} actions={<ButtonLink href="/jobs">{t.seeJobs}</ButtonLink>}>
      {t.askForLink}
    </StatusCard>
  );
}
