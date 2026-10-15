import type { Metadata } from "next";
import { ManageJobs } from "@/components/employer/ManageJobs";

export const metadata: Metadata = { title: "职位管理", robots: { index: false } };

export default function ManageJobsPage() {
  return <ManageJobs />;
}
