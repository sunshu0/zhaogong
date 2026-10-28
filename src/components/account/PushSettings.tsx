"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { useMessages } from "@/i18n/client";
import { pushMessages } from "@/i18n/messages/push";
import { decode64 } from "@/lib/push/rules";
import { disableMyPush, enableMyPush, myPushSettings } from "@/app/[lang]/account/push-actions";

type State = "checking" | "enabled" | "disabled" | "unavailable" | "unsupported" | "denied" | "failed";
const supported = () =>
  window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function existingSubscription() {
  const worker = await navigator.serviceWorker.getRegistration("/");
  return (await worker?.pushManager.getSubscription()) ?? null;
}
async function waitForWorker(worker: ServiceWorkerRegistration) {
  if (worker.active) return;
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
}
/** No automatic permission prompt. Each enable press creates a fresh endpoint and binds it to the server's session. */
export function PushSettings() {
  const session = useSession();
  const scope = session ? identityScope(session) : "";
  const t = useMessages(pushMessages);
  const [state, setState] = useState<State>("checking");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const [roleHint, setRoleHint] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    async function read() {
      if (!supported()) return "unsupported" as const;
      const subscription = await existingSubscription();
      if (Notification.permission === "denied") {
        return "denied" as const;
      }
      const settings = await myPushSettings(subscription?.endpoint);
      if (!settings || settings.scope !== scope) return "failed" as const;
      if (active) setPublicKey(settings.publicKey);
      if (!settings.publicKey) return "unavailable" as const;
      return settings.enabled && Notification.permission === "granted" ? ("enabled" as const) : ("disabled" as const);
    }
    const check = () => {
      if (busy.current) return;
      const startedAt = revision.current;
      void read()
        .then((value) => {
          if (active && !busy.current && startedAt === revision.current) {
            setState(value);
            setRoleHint(new URLSearchParams(location.search).has("pushRole"));
          }
        })
        .catch(() => {
          if (active && !busy.current && startedAt === revision.current) setState("failed");
        });
    };
    check();
    window.addEventListener("focus", check);
    return () => {
      active = false;
      mounted.current = false;
      window.removeEventListener("focus", check);
    };
  }, [scope]);
  if (!session || session.staff) return null;
  return (
    <Section look="sheet">
      <div className="space-y-3 py-group">
        <h2 className="text-subtitle font-semibold">{t.title}</h2>
        <p className="text-body text-muted">{t.detail}</p>
        {roleHint && (
          <p role="status" className="text-body text-warn">
            {t.roleHint}
          </p>
        )}
        <p role="status" className="text-meta">
          {notice || t[state]}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || ["checking", "unsupported", "unavailable", "denied"].includes(state)}
            onClick={() => {
              start(async () => {
                busy.current = true;
                revision.current++;
                setNotice("");
                let subscription: PushSubscription | null = null;
                try {
                  if (!publicKey) {
                    setState("unavailable");
                    return;
                  }
                  // Permission is requested only inside this explicit user action.
                  const permission = await Notification.requestPermission();
                  if (permission !== "granted") {
                    if (mounted.current) setState(permission === "denied" ? "denied" : "disabled");
                    return;
                  }
                  const settings = await myPushSettings();
                  if (!settings?.publicKey || settings.scope !== scope) {
                    setState("unavailable");
                    return;
                  }
                  const previous = await existingSubscription();
                  if (previous) {
                    if (!(await disableMyPush(previous.endpoint, scope)))
                      throw new Error("Could not disable previous subscription");
                    if (!(await previous.unsubscribe())) throw new Error("Could not cancel previous subscription");
                  }
                  const worker = await navigator.serviceWorker.register("/api/push/worker", {
                    scope: "/",
                    updateViaCache: "none",
                  });
                  await waitForWorker(worker);
                  subscription = await worker.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: decode64(settings.publicKey),
                  });
                  if (!(await enableMyPush(subscription.toJSON(), scope)))
                    throw new Error("Could not save subscription");
                  if (mounted.current) setState("enabled");
                } catch {
                  await subscription?.unsubscribe().catch(() => undefined);
                  if (mounted.current) setState("failed");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? t.working : t.enable}
          </Button>
          <Button
            variant="secondary"
            disabled={pending || state === "checking" || state === "unsupported"}
            onClick={() => {
              start(async () => {
                busy.current = true;
                revision.current++;
                setNotice("");
                try {
                  const subscription = await existingSubscription();
                  if (subscription && !(await disableMyPush(subscription.endpoint, scope)))
                    throw new Error("Could not remove subscription");
                  if (mounted.current) setState("disabled");
                  if (subscription && !(await subscription.unsubscribe()) && mounted.current) setNotice(t.closeFailed);
                } catch {
                  if (mounted.current) setState("failed");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {t.disable}
          </Button>
        </div>
        <p className="text-meta text-muted">{t.note}</p>
      </div>
    </Section>
  );
}
