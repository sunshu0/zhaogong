import { Store } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";
import { messages } from "@/i18n/server";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";

export default async function EmployerNotFound() {
  const t = (await messages(seekerEmployerMessages)).notFound;
  return (
    <StatusCard icon={Store} title={t.title} actions={<ButtonLink href="/jobs">{t.others}</ButtonLink>}>
      {t.body}
    </StatusCard>
  );
}
