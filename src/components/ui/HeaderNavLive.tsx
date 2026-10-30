import { connection } from "next/server";
import { HeaderNav } from "@/components/ui/HeaderNav";
import { preparingSections } from "@/lib/external-jobs/section-counts";

/** HeaderNav with the job sections that have no job yet marked 筹备中 and put last (user feedback 10-30 #4). */
export async function HeaderNavLive() {
  await connection();
  return <HeaderNav preparing={await preparingSections()} />;
}
