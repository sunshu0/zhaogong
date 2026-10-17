import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";

/** Any address with no page (and every notFound() without its own not-found.tsx), in Chinese like the rest. */
export default function NotFound() {
  return (
    <StatusCard
      icon={SearchX}
      title="这个页面不存在"
      actions={
        <>
          <ButtonLink href="/jobs">找工作</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            回首页
          </ButtonLink>
        </>
      }
    >
      链接可能有误，或者内容已经下架。
    </StatusCard>
  );
}
