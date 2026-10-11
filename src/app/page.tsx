// Placeholder. Line A replaces this with the job list.
import Link from "next/link";
import { listJobs } from "@/lib/data";

export default async function Home() {
  const jobs = await listJobs({ country: "NZ" });
  return (
    <ul className="space-y-2">
      {jobs.map((j) => (
        <li key={j.id} className="rounded-lg border border-border bg-surface p-3">
          <Link href={`/jobs/${j.id}`}>{j.titleZh}</Link>
        </li>
      ))}
    </ul>
  );
}
