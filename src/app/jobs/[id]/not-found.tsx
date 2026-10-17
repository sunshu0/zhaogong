import { BriefcaseBusiness } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";

export default function JobNotFound() {
  return (
    <StatusCard
      icon={BriefcaseBusiness}
      title="这个职位不存在或已下架"
      actions={<ButtonLink href="/jobs">看看其他职位</ButtonLink>}
    >
      链接可能有误，或者雇主已经关闭了这个职位。
    </StatusCard>
  );
}
