// Real sign-in and server sessions (line A). Server only: import from Server Functions and Server Components.
export { CODE_TTL_MS, MAX_ATTEMPTS, RESEND_AFTER_MS, SESSION_TTL_MS, sessionCookieName } from "@/lib/auth/config";
export {
  generateCode,
  hashCode,
  requestCode,
  verifyCode,
  type RequestCodeResult,
  type VerifyCodeResult,
} from "@/lib/auth/codes";
export { clientIp } from "@/lib/auth/limits";
export { canSendCodes, sendSignInCode } from "@/lib/auth/delivery";
export {
  AuthError,
  createSession,
  getCurrentSession,
  requireEmployer,
  requireSession,
  sessionCookieOptions,
  signOut,
  switchRole,
  type CookieJar,
  type SessionView,
} from "@/lib/auth/sessions";
