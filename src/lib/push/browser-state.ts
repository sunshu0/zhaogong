import { decode64 } from "./rules";

const LOCK = "zhaogong-browser-push";
const CHANNEL = "zhaogong-browser-push-state";
const LOCAL_EVENT = "zhaogong:browser-push-state";
export type PushChange = "changing" | "changed";
type Subscription = Pick<PushSubscription, "endpoint" | "toJSON" | "unsubscribe">;
export type PushSettings = { scope: string; publicKey: string | null; enabled: boolean };
export type PushClient = {
  settings: (endpoint?: string) => Promise<PushSettings | null>;
  existing: (check: () => void) => Promise<Subscription | null>;
  create: (key: string, check: () => void) => Promise<Subscription>;
  save: (value: PushSubscriptionJSON, scope: string) => Promise<boolean>;
  remove: (endpoint: string, scope: string) => Promise<boolean>;
};

/** Native origin-wide locks cover tabs and React remounts. Aborting cancels a queued request, never its holder. */
export function withPushLock<T>(operation: () => Promise<T>, signal: AbortSignal, locks = navigator.locks): Promise<T> {
  return locks.request(LOCK, { mode: "exclusive", signal }, operation);
}

export function requireCurrentPush(current: () => boolean): void {
  if (!current()) throw new Error("Push settings identity changed");
}

export async function existingBrowserPush(check: () => void): Promise<PushSubscription | null> {
  check();
  const worker = await navigator.serviceWorker.getRegistration("/");
  check();
  const subscription = (await worker?.pushManager.getSubscription()) ?? null;
  check();
  return subscription;
}

export async function createBrowserPush(key: string, check: () => void): Promise<PushSubscription> {
  check();
  const worker = await navigator.serviceWorker.register("/api/push/worker", { scope: "/", updateViaCache: "none" });
  check();
  if (!worker.active) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Worker activation timed out")), 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    check();
  }
  // Do not discard a late result here: the lock holder must receive it and roll it back before releasing its lock.
  return worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decode64(key) });
}

/** Call only inside withPushLock. Rollback owns only this operation's created endpoint and finishes before release. */
export async function enableBrowserPush(
  client: PushClient,
  scope: string,
  current: () => boolean,
): Promise<"enabled" | "unavailable"> {
  const check = () => requireCurrentPush(current);
  let created: Subscription | null = null;
  try {
    check();
    const settings = await client.settings();
    check();
    if (!settings || settings.scope !== scope) throw new Error("Push identity changed");
    if (!settings.publicKey) return "unavailable";
    const previous = await client.existing(check);
    check();
    if (previous) {
      if (!(await client.remove(previous.endpoint, scope))) throw new Error("Could not disable previous subscription");
      check();
      if (!(await previous.unsubscribe())) throw new Error("Could not cancel previous subscription");
      check();
    }
    created = await client.create(settings.publicKey, check);
    check();
    if (!(await client.save(created.toJSON(), scope))) throw new Error("Could not save subscription");
    check();
    return "enabled";
  } catch (error) {
    if (created) {
      // The browser operation cannot be aborted midway. Keep the origin lock until this exact result is cancelled.
      await client.remove(created.endpoint, scope).catch(() => false);
      await created.unsubscribe().catch(() => false);
    }
    throw error;
  }
}

/** Call only inside withPushLock; a browser cancellation failure is different from a failed server deletion. */
export async function disableBrowserPush(client: PushClient, scope: string, current: () => boolean): Promise<boolean> {
  const check = () => requireCurrentPush(current);
  check();
  const settings = await client.settings();
  check();
  if (!settings || settings.scope !== scope) throw new Error("Push identity changed");
  const subscription = await client.existing(check);
  check();
  if (!subscription) return true;
  if (!(await client.remove(subscription.endpoint, scope))) throw new Error("Could not remove subscription");
  check();
  const cancelled = await subscription.unsubscribe();
  check();
  return cancelled;
}

/** Coordination sends only change signals and creates no local storage containing endpoints, keys, account or role. */
export function announcePushChange(change: PushChange): void {
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: change }));
  if ("BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage(change);
      channel.close();
    } catch {
      /* Optional refresh signals must never change the outcome of a saved setting. */
    }
  }
}

export function onPushChange(receive: (change: PushChange) => void): () => void {
  const accept = (value: unknown) => {
    if (value === "changing" || value === "changed") receive(value);
  };
  const local = (event: Event) => accept((event as CustomEvent).detail);
  window.addEventListener(LOCAL_EVENT, local);
  let channel: BroadcastChannel | null = null;
  try {
    channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  } catch {
    /* Focus still rechecks. */
  }
  if (channel) channel.onmessage = (event) => accept(event.data);
  return () => {
    window.removeEventListener(LOCAL_EVENT, local);
    channel?.close();
  };
}
