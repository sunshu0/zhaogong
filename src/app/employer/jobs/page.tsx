import type { Metadata } from "next";
import { demoAccounts } from "@/components/employer/demo-accounts";
import { ManageJobs } from "@/components/employer/ManageJobs";

export const metadata: Metadata = { title: "管理职位", robots: { index: false } };

export default async function ManageJobsPage() {
  return <ManageJobs accounts={await demoAccounts()} />;
}
