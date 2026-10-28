import { describe, expect, it, vi } from "vitest";
import { disableBrowserPush, enableBrowserPush, existingBrowserPush, withPushLock, type PushClient } from "./browser-state";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Deterministic native-lock contract: one origin queue, abort removes only waiters, never an active holder. */
function originLocks(): LockManager {
  let tail = Promise.resolve();
  return {
    request<T>(_name: string, options: LockOptions, callback: () => Promise<T>): Promise<T> {
      const release = deferred<void>();
      const ahead = tail;
      tail = tail.then(() => release.promise);
      return new Promise<T>((resolve, reject) => {
        let started = false;
        const abort = () => { if (!started) reject(new DOMException("Aborted", "AbortError")); };
        options.signal?.addEventListener("abort", abort, { once: true });
        void ahead.then(async () => {
          options.signal?.removeEventListener("abort", abort);
          try {
            if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
            started = true;
            resolve(await callback());
          } catch (error) { reject(error); }
          finally { release.resolve(); }
        });
        if (options.signal?.aborted) abort();
      });
    },
  } as unknown as LockManager;
}

function fixture() {
  let browser: Awaited<ReturnType<PushClient["existing"]>> = null;
  const trace: string[] = [];
  const subscription = (endpoint: string, cancel = async () => true) => ({
    endpoint,
    toJSON: () => ({ endpoint }),
    unsubscribe: vi.fn(async () => {
      const result = await cancel();
      trace.push(`cancel:${endpoint}`);
      if (browser?.endpoint === endpoint) browser = null;
      return result;
    }),
  });
  const client: PushClient = {
    settings: vi.fn(async () => ({ scope: "A", publicKey: "key", enabled: false })),
    existing: vi.fn(async () => browser),
    create: vi.fn(async () => { const created = subscription("A"); browser = created; return created; }),
    save: vi.fn(async (value) => { trace.push(`save:${value.endpoint}`); return true; }),
    remove: vi.fn(async (endpoint) => { trace.push(`remove:${endpoint}`); return true; }),
  };
  return { client, trace, subscription, setBrowser: (value: typeof browser) => { browser = value; }, getBrowser: () => browser };
}

describe("origin-wide browser push changes", () => {
  it("does not continue a browser read after the identity changes while registration lookup is pending", async () => {
    const registration = deferred<ServiceWorkerRegistration | undefined>();
    const getSubscription = vi.fn(async () => null);
    let current = true;
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration: () => registration.promise } });
    try {
      const read = existingBrowserPush(() => { if (!current) throw new Error("Identity changed"); });
      const rejected = expect(read).rejects.toThrow("Identity changed");
      current = false;
      registration.resolve({ pushManager: { getSubscription } } as unknown as ServiceWorkerRegistration);
      await rejected;
      expect(getSubscription).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("finishes a stale remount's exact rollback before a second identity can create/save its endpoint", async () => {
    const locks = originLocks(), f = fixture();
    const createStarted = deferred<void>(), finishCreate = deferred<void>(), cancelStarted = deferred<void>(), finishCancel = deferred<void>();
    let current = true;
    const a = f.subscription("A", async () => { cancelStarted.resolve(); await finishCancel.promise; return true; });
    vi.mocked(f.client.create).mockImplementationOnce(async () => {
      createStarted.resolve();
      await finishCreate.promise;
      f.setBrowser(a);
      return a;
    });
    const first = withPushLock(() => enableBrowserPush(f.client, "A", () => current), new AbortController().signal, locks);
    // Register the rejection handler before advancing the delayed native subscribe.
    const refused = expect(first).rejects.toThrow("identity changed");
    await createStarted.promise;
    current = false; // A unmounted while the browser subscribe was still outstanding.
    const clientB = { ...f.client, settings: vi.fn(async () => ({ scope: "B", publicKey: "key", enabled: false })), create: vi.fn(async () => {
      const b = f.subscription("B"); f.setBrowser(b); return b;
    }) };
    const second = withPushLock(() => enableBrowserPush(clientB, "B", () => true), new AbortController().signal, locks);
    finishCreate.resolve();
    await cancelStarted.promise;
    expect(clientB.settings).not.toHaveBeenCalled();
    expect(f.client.save).not.toHaveBeenCalled();
    finishCancel.resolve();
    await refused;
    expect(await second).toBe("enabled");
    expect(f.getBrowser()?.endpoint).toBe("B");
    expect(f.trace).toEqual(["remove:A", "cancel:A", "save:B"]);
    expect(a.unsubscribe).toHaveBeenCalledOnce();
  });

  it("serializes a second tab's disable and read after a pending enable; no intermediate browser state is observed", async () => {
    const locks = originLocks(), f = fixture(), saved = deferred<void>(), finishSave = deferred<void>();
    vi.mocked(f.client.save).mockImplementation(async (value) => { saved.resolve(); await finishSave.promise; f.trace.push(`save:${value.endpoint}`); return true; });
    const first = withPushLock(() => enableBrowserPush(f.client, "A", () => true), new AbortController().signal, locks);
    await saved.promise;
    const observed = vi.fn(async () => f.getBrowser()?.endpoint);
    const read = withPushLock(observed, new AbortController().signal, locks);
    const close = withPushLock(() => disableBrowserPush(f.client, "A", () => true), new AbortController().signal, locks);
    expect(observed).not.toHaveBeenCalled();
    finishSave.resolve();
    expect(await first).toBe("enabled");
    expect(await read).toBe("A");
    expect(await close).toBe(true);
    expect(f.getBrowser()).toBeNull();
    expect(f.trace).toEqual(["save:A", "remove:A", "cancel:A"]);
  });

  it("aborts an unmounted waiter without running it or aborting the active lock holder", async () => {
    const locks = originLocks(), held = deferred<void>(), entered = deferred<void>(), waiter = new AbortController();
    const first = withPushLock(async () => { entered.resolve(); await held.promise; return "finished"; }, new AbortController().signal, locks);
    await entered.promise;
    const operation = vi.fn(async () => "must not run");
    const second = withPushLock(operation, waiter.signal, locks);
    const cancelled = expect(second).rejects.toMatchObject({ name: "AbortError" });
    waiter.abort();
    await cancelled;
    expect(operation).not.toHaveBeenCalled();
    held.resolve();
    expect(await first).toBe("finished");
  });

  it("stops before subscription mutation when a delayed scope read belongs to an unmounted instance", async () => {
    const f = fixture(), settings = deferred<Awaited<ReturnType<PushClient["settings"]>>>();
    let current = true;
    vi.mocked(f.client.settings).mockReturnValue(settings.promise);
    const result = enableBrowserPush(f.client, "A", () => current);
    const rejected = expect(result).rejects.toThrow("identity changed");
    current = false;
    settings.resolve({ scope: "A", publicKey: "key", enabled: false });
    await rejected;
    expect(f.client.existing).not.toHaveBeenCalled();
    expect(f.client.remove).not.toHaveBeenCalled();
    expect(f.client.create).not.toHaveBeenCalled();
  });
});
