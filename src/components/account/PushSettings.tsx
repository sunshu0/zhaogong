"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { useMessages } from "@/i18n/client";
import { pushMessages } from "@/i18n/messages/push";
import {
  announcePushChange,
  createBrowserPush,
  disableBrowserPush,
  enableBrowserPush,
  existingBrowserPush,
  onPushChange,
  requireCurrentPush,
  withPushLock,
  type PushClient,
} from "@/lib/push/browser-state";
import { disableMyPush, disableMySessionPush, enableMyPush, myPushSettings } from "@/app/[lang]/account/push-actions";

type State = "checking" | "enabled" | "disabled" | "unavailable" | "unsupported" | "coordination" | "denied" | "failed";
const supported = () =>
  window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const coordinated = () => !!navigator.locks?.request;
const client: PushClient = {
  settings: myPushSettings,
  existing: existingBrowserPush,
  create: createBrowserPush,
  save: enableMyPush,
  remove: disableMyPush,
};

/** Permission needs a direct user gesture; shared browser state changes then run under one origin-wide lock. */
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
  const lifetime = useRef<AbortController | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    busy.current = false;
    revision.current++;
    const current = () => !controller.signal.aborted;
    async function read() {
      if (!supported()) return { state: "unsupported" as const, publicKey: null };
      if (!coordinated()) return { state: "coordination" as const, publicKey: null };
      return withPushLock(async () => {
        requireCurrentPush(current);
        const subscription = await existingBrowserPush(() => requireCurrentPush(current));
        requireCurrentPush(current);
        if (Notification.permission === "denied") return { state: "denied" as const, publicKey: null };
        const settings = await myPushSettings(subscription?.endpoint);
        requireCurrentPush(current);
        if (!settings || settings.scope !== scope) throw new Error("Push identity changed");
        const next: State = !settings.publicKey
          ? "unavailable"
          : settings.enabled && Notification.permission === "granted"
            ? "enabled"
            : "disabled";
        return { state: next, publicKey: settings.publicKey };
      }, controller.signal);
    }
    const check = () => {
      if (busy.current || !current()) return;
      const startedAt = revision.current;
      void read()
        .then((value) => {
          if (current() && !busy.current && startedAt === revision.current) {
            setState(value.state);
            setPublicKey(value.publicKey);
            setNotice("");
            setRoleHint(new URLSearchParams(location.search).has("pushRole"));
          }
        })
        .catch(() => {
          if (current() && !busy.current && startedAt === revision.current) setState("failed");
        });
    };
    const stopChanges = onPushChange((change) => {
      if (busy.current || !current()) return;
      revision.current++;
      setNotice("");
      setState("checking");
      if (change === "changed") check();
    });
    check();
    window.addEventListener("focus", check);
    return () => {
      controller.abort(); // A queued request is cancelled; a holder finishes its rollback before releasing the lock.
      stopChanges();
      window.removeEventListener("focus", check);
    };
  }, [scope]);

  if (!session || session.staff) return null;

  async function change(kind: "enable" | "disable") {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted) return;
    busy.current = true;
    const operation = ++revision.current;
    const current = () => !controller.signal.aborted && revision.current === operation;
    setNotice("");
    try {
      if (!supported() || !coordinated()) {
        if (kind === "enable") {
          setState(supported() ? "coordination" : "unsupported");
          return;
        }
        // Cancelling on the server needs neither permission, keys, nor browser coordination support.
        if (!(await disableMySessionPush(scope))) throw new Error("Could not stop session alerts");
        requireCurrentPush(current);
        setState(supported() ? "coordination" : "unsupported");
        setNotice(t.browserCloseNeeded);
        return;
      }
      if (kind === "enable") {
        if (!publicKey) {
          setState("unavailable");
          return;
        }
        // Keep this before the lock await so Safari still has the explicit click's user activation.
        const permission = await Notification.requestPermission();
        requireCurrentPush(current);
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "disabled");
          return;
        }
      }
      const result = await withPushLock<"enabled" | "unavailable" | "disabled" | "browser-close-needed">(async () => {
        requireCurrentPush(current);
        announcePushChange("changing");
        try {
          return kind === "enable"
            ? await enableBrowserPush(client, scope, current)
            : (await disableBrowserPush(client, scope, current))
              ? "disabled"
              : "browser-close-needed";
        } finally {
          announcePushChange("changed");
        }
      }, controller.signal);
      requireCurrentPush(current);
      setState(result === "browser-close-needed" ? "disabled" : result);
      if (result === "browser-close-needed") setNotice(t.closeFailed);
    } catch {
      if (current()) setState("failed");
    } finally {
      if (lifetime.current === controller && revision.current === operation) busy.current = false;
    }
  }

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
            disabled={pending || ["checking", "unsupported", "coordination", "unavailable", "denied"].includes(state)}
            onClick={() => start(() => change("enable"))}
          >
            {pending ? t.working : t.enable}
          </Button>
          <Button
            variant="secondary"
            disabled={pending || state === "checking"}
            onClick={() => start(() => change("disable"))}
          >
            {t.disable}
          </Button>
        </div>
        <p className="text-meta text-muted">{t.note}</p>
      </div>
    </Section>
  );
}
