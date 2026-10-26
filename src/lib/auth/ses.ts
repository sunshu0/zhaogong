// Sending mail through Amazon SES (#16, ADR 0032): one plain-text email per call, over the SES v2 HTTPS API signed
// with aws4fetch, so it runs in the Cloudflare Worker (no SMTP). Only the sign-in codes use it. Server only.
import { AwsClient } from "aws4fetch";

export type SesConfig = {
  /** The SES region the sending domain is verified in, e.g. ap-southeast-2 (Sydney). */
  region: string;
  /** The From address, on the verified domain, e.g. "找工 <no-reply@example.com>". */
  from: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** SES settings from the environment; undefined unless all four are set. */
export function sesConfig(env: Record<string, string | undefined> = process.env): SesConfig | undefined {
  const region = env.SES_REGION?.trim();
  const from = env.MAIL_FROM?.trim();
  const accessKeyId = env.SES_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.SES_SECRET_ACCESS_KEY?.trim();
  if (!region || !from || !accessKeyId || !secretAccessKey) return undefined;
  return { region, from, accessKeyId, secretAccessKey };
}

/**
 * The From address as SES takes it: the address must be 7-bit ASCII, and a display name with other characters
 * ("找工") has to be in MIME encoded-word syntax (RFC 2047) — SES's own words, under SendEmail's Source:
 * https://docs.aws.amazon.com/ses/latest/APIReference/API_SendEmail.html. An all-ASCII From is left as it is.
 */
export function sesFromAddress(from: string): string {
  const named = /^\s*"?(.*?)"?\s*<([^<>]+)>\s*$/.exec(from);
  if (!named || /^[\x20-\x7e]*$/.test(named[1])) return from;
  // Encoded words are at most 75 characters (RFC 2047 2): 45 bytes of the name each, cut between characters.
  const words: string[] = [];
  let chunk: number[] = [];
  const flush = () => {
    if (chunk.length) words.push(`=?UTF-8?B?${btoa(String.fromCharCode(...chunk))}?=`);
    chunk = [];
  };
  for (const char of named[1]) {
    const bytes = new TextEncoder().encode(char);
    if (chunk.length + bytes.length > 45) flush();
    chunk.push(...bytes);
  }
  flush();
  return `${words.join(" ")} <${named[2]}>`;
}

export type SesResult = { ok: true; messageId: string } | { ok: false; status: number; error: string };

/** How long one send may take before it counts as failed. */
const SEND_TIMEOUT_MS = 10_000;

/**
 * Sends one plain-text email. Never throws: a failure comes back with the HTTP status (0 when SES could not be
 * reached) and SES's error type, without the address, for the log. No retries here: the person asks again.
 */
export async function sendSesEmail(
  config: SesConfig,
  mail: { to: string; subject: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SesResult> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "ses",
    region: config.region,
  });
  const body = JSON.stringify({
    FromEmailAddress: sesFromAddress(config.from),
    Destination: { ToAddresses: [mail.to] },
    Content: {
      Simple: {
        Subject: { Data: mail.subject, Charset: "UTF-8" },
        Body: { Text: { Data: mail.text, Charset: "UTF-8" } },
      },
    },
  });
  try {
    const request = await client.sign(`https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const response = await fetchImpl(request, { signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
    const answer = (await response.json().catch(() => ({}))) as { MessageId?: string; message?: string };
    if (response.ok && answer.MessageId) return { ok: true, messageId: answer.MessageId };
    const type = response.headers.get("x-amzn-errortype")?.split(":")[0] || answer.message || "unknown";
    return { ok: false, status: response.status, error: type };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.name : "unknown" };
  }
}
