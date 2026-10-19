// What the analytics pieces share (#313, ADR 0025 §6–7), kept apart from Analytics.tsx so that <NoClarity /> and the
// footer's 统计设置 do not bring the whole loader into a page's JavaScript.
import type { Setup } from "@/lib/analytics/clarity-rules";
import { isTestBuild } from "@/lib/test-build";

/** This build's Clarity setup: NEXT_PUBLIC_CLARITY_ID and NODE_ENV are fixed when the build is made. */
export const CLARITY_SETUP: Setup = {
  projectId: process.env.NEXT_PUBLIC_CLARITY_ID,
  production: process.env.NODE_ENV === "production",
  testBuild: isTestBuild(),
};

/** The event the footer's 统计设置 sends to open the consent prompt again. */
export const OPEN_CONSENT_EVENT = "zhaogong:open-consent";

/** Set on window by <NoClarity /> while a page that must not be recorded is on screen. */
export const NO_CLARITY_FLAG = "zgNoClarity";

export type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global {
  interface Window {
    clarity?: ClarityFn;
    zgNoClarity?: boolean;
  }
}
