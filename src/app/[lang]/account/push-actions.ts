"use server";

import { currentPushSession } from "@/lib/auth/sessions";
import { isModerator } from "@/db/moderators";
import {
  claimPushAttempt,
  keepPushSubscription,
  ownsPushSubscription,
  removePushSubscription,
} from "@/db/push-subscriptions";
import { decode64, parseSubscription, pushEndpoint } from "@/lib/push/rules";
import { readyVapidConfig } from "@/lib/push/web-push";
import { requestLang } from "@/i18n/server";
import { scopeOf } from "@/lib/chat-server/identity";

export async function myPushSettings(endpoint?: string) {
  const owner = await currentPushSession();
  if (!owner || (await isModerator(owner.view.email))) return null;
  const config = await readyVapidConfig();
  const clean = pushEndpoint(endpoint);
  return {
    scope: scopeOf(owner.view),
    publicKey: config?.publicKey ?? null,
    enabled: !!clean && (await ownsPushSubscription(owner, clean)),
  };
}

export async function enableMyPush(value: unknown, expectedScope: string): Promise<boolean> {
  const owner = await currentPushSession();
  const subscription = parseSubscription(value);
  if (
    !owner ||
    !subscription ||
    scopeOf(owner.view) !== expectedScope ||
    !(await readyVapidConfig()) ||
    (await isModerator(owner.view.email))
  )
    return false;
  if (!(await claimPushAttempt(owner))) return false;
  // Reject points which have the right byte length but do not lie on the curve, before keeping them.
  try {
    await crypto.subtle.importKey(
      "raw",
      decode64(subscription.keys.p256dh),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
  } catch {
    return false;
  }
  return keepPushSubscription(owner, subscription, await requestLang());
}

export async function disableMyPush(endpoint: string, expectedScope: string): Promise<boolean> {
  const owner = await currentPushSession();
  const clean = pushEndpoint(endpoint);
  if (!owner || !clean || scopeOf(owner.view) !== expectedScope) return false;
  await removePushSubscription(owner, clean);
  return true;
}
