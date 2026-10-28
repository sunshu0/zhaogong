import { discardExpiredPush, pushRecipients } from "@/db/push-subscriptions";
import { sharedConversationId } from "@/lib/chat-server/shared-view";
import { pushOpenHref, type PushRole } from "./rules";
import { sendPush, vapidAuthorizer, vapidConfig } from "./web-push";

/** Best effort after a committed new chat message. No message text, contact information or names leave the site. */
export async function deliverChatPush(
  row: { id: string; seekerEmail: string; employerId: string; jobId: string | null },
  sender: PushRole,
): Promise<void> {
  const config = vapidConfig();
  if (!config || !row.jobId) return;
  const role = sender === "seeker" ? "employer" : "seeker";
  const recipients = await pushRecipients(row, role);
  // A business team's recipients mostly share one push service: sign once per origin, not once per subscription.
  const authorize = vapidAuthorizer(config);
  let sent = 0,
    expired = 0,
    failed = 0,
    skipped = 0;
  const deadline = Date.now() + 20_000;
  // Small bounded batches keep subrequests, CPU and memory bounded within one request's background lifetime.
  for (let offset = 0; offset < recipients.length; offset += 10) {
    if (Date.now() >= deadline) {
      skipped = recipients.length - offset;
      break;
    }
    await Promise.all(
      recipients.slice(offset, offset + 10).map(async ({ subscription }) => {
        const conversation = sharedConversationId({ ...row, jobId: row.jobId! }, role);
        const payload = JSON.stringify({
          version: 1,
          title: subscription.lang === "en" ? "Zhaogong" : "找工",
          body:
            subscription.lang === "en"
              ? "You have a new message. Open Zhaogong to read it."
              : "你有一条新消息，打开找工查看。",
          url: pushOpenHref(role, conversation),
          tag: "zhaogong-chat",
        });
        try {
          const outcome = await sendPush(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            config,
            fetch,
            authorize,
          );
          if (outcome === "expired") {
            await discardExpiredPush(subscription.endpoint, subscription.sessionId, subscription.updatedAt);
            expired++;
          } else if (outcome === "sent") sent++;
          else failed++;
        } catch {
          failed++;
        }
      }),
    );
  }
  if (recipients.length) console.info(JSON.stringify({ event: "chat_push", sent, expired, failed, skipped }));
}
