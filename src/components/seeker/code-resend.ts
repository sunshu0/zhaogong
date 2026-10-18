// 重新获取验证码 (#184): a new code at most once a minute — the server's rule (src/lib/auth/codes.ts), which also
// says how long is left. The sign-in page counts that down on the button, from a moment in time, so a tab left in
// the background is not behind when it comes back.

/** Whole seconds until another code may be asked for, at `now` (both in ms); 0 when it may. */
export function secondsLeft(resendAt: number, now: number): number {
  return Math.max(0, Math.ceil((resendAt - now) / 1000));
}

/** The button's words while waiting, and after. */
export function resendLabel(left: number): string {
  return left > 0 ? `${left} 秒后可重新获取` : "重新获取验证码";
}
