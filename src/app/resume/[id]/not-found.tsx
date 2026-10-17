import { FileText } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";

// Round 19 walk: the same card as a job's or an employer's 404 (#161).
export default function SharedResumeNotFound() {
  return (
    <StatusCard
      icon={FileText}
      title="这份简历的分享链接已关闭或不存在"
      actions={<ButtonLink href="/jobs">看看找工上的职位</ButtonLink>}
    >
      请向求职者要新的链接。
    </StatusCard>
  );
}
