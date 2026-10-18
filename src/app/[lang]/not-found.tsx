import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";
import { uiMessages } from "@/i18n/messages/ui";
import { messages } from "@/i18n/server";

/** Any address with no page (and every notFound() without its own not-found.tsx), in the page's language. */
export default async function NotFound() {
  const t = (await messages(uiMessages)).notFound;
  return (
    <StatusCard
      icon={SearchX}
      title={t.title}
      actions={
        <>
          <ButtonLink href="/jobs">{t.findJobs}</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            {t.home}
          </ButtonLink>
        </>
      }
    >
      {t.body}
    </StatusCard>
  );
}
