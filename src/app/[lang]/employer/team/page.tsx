import type { Metadata } from "next";
import { TeamPage } from "@/components/employer/TeamPage";

export const metadata: Metadata = {
  title: "团队",
  description: "邀请同事一起管理企业的职位、申请和聊天，分管理员和成员。",
};

export default function EmployerTeamPage() {
  return <TeamPage />;
}
