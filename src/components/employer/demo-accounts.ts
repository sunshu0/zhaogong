// Demo businesses an employer can sign in as, chosen to show each verification state.
import { getEmployer } from "@/lib/data";
import type { Employer } from "@/lib/types";

export const DEMO_ACCOUNT_IDS = ["e1", "e2", "e4"] as const;

export async function demoAccounts(): Promise<Employer[]> {
  const found = await Promise.all(DEMO_ACCOUNT_IDS.map((id) => getEmployer(id)));
  return found.filter((e): e is Employer => e != null);
}
