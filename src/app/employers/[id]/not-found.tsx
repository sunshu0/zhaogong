import { Store } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";

export default function EmployerNotFound() {
  return (
    <StatusCard
      icon={Store}
      title="这个雇主不存在或已停用"
      actions={<ButtonLink href="/jobs">看看其他职位</ButtonLink>}
    >
      链接可能有误，或者这家雇主已经不在找工上招聘。
    </StatusCard>
  );
}
