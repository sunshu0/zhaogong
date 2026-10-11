import { connection } from "next/server";

/** The time of the current request. Waits for the request, so the value never ends up in a prerendered shell. */
export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}
