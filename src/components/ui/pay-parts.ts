import { formatPay } from "@/components/seeker/format";
import type { CountryCode, PayRange } from "@/lib/types";

/** formatPay split for display: "$25–27/小时" → { amount: "$25–27", unit: "/小时" }. */
export function payParts(pay: PayRange, country: CountryCode): { amount: string; unit: string } {
  const text = formatPay(pay, country);
  const slash = text.indexOf("/");
  return slash < 0 ? { amount: text, unit: "" } : { amount: text.slice(0, slash), unit: text.slice(slash) };
}
