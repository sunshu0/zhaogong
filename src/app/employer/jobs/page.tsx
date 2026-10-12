import type { Metadata } from "next";
import { ManageJobs } from "@/components/employer/ManageJobs";

export const metadata: Metadata = { title: "管理职位", robots: { index: false } };

export default function ManageJobsPage() {
  return <ManageJobs />;
}
