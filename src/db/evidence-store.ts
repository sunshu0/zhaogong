// Where report screenshots are kept (ADR 0027 §2), behind one small interface: on the Cloudflare deployment an R2
// bucket bound as EVIDENCE_BUCKET (docs/cloudflare-deployment.md), elsewhere files under data/uploads/report-evidence
// (data/ is not in git). Nothing here is public: /api/report-evidence/[id] hands a file to a moderator. Server only.
import type { ImageType } from "@/lib/image-metadata";

export interface EvidenceStore {
  put(key: string, bytes: Uint8Array, type: ImageType): Promise<void>;
  get(key: string): Promise<Uint8Array<ArrayBuffer> | undefined>;
  remove(keys: readonly string[]): Promise<void>;
}

/** The part of Cloudflare's R2Bucket this uses. */
interface R2BucketLike {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(keys: string | string[]): Promise<void>;
}

/** Keys are made here (crypto.randomUUID): letters, digits and dashes only, so a key never leaves its folder. */
const KEY = /^[0-9a-f-]{36}$/;
const checked = (key: string) => {
  if (!KEY.test(key)) throw new Error(`Not an evidence key: ${key}`);
  return key;
};

export function r2Store(bucket: R2BucketLike): EvidenceStore {
  return {
    async put(key, bytes, type) {
      await bucket.put(checked(key), bytes, { httpMetadata: { contentType: type } });
    },
    async get(key) {
      const object = await bucket.get(checked(key));
      return object ? new Uint8Array(await object.arrayBuffer()) : undefined;
    },
    async remove(keys) {
      if (keys.length) await bucket.delete(keys.map(checked));
    },
  };
}

export function fileStore(dir: string): EvidenceStore {
  const fs = () => import("node:fs/promises");
  const file = async (key: string) => (await import("node:path")).join(dir, checked(key));
  return {
    async put(key, bytes) {
      const { mkdir, writeFile } = await fs();
      await mkdir(dir, { recursive: true });
      await writeFile(await file(key), bytes);
    },
    async get(key) {
      const { readFile } = await fs();
      return readFile(await file(key)).then(
        (buffer) => new Uint8Array(buffer),
        () => undefined,
      );
    },
    async remove(keys) {
      const { rm } = await fs();
      for (const key of keys) await rm(await file(key), { force: true });
    },
  };
}

let override: EvidenceStore | undefined;

/** For tests: use this store (an in-memory one) until called again with undefined. */
export function setEvidenceStoreForTests(store: EvidenceStore | undefined): void {
  override = store;
}

/**
 * The store for this server. On Workers (OpenNext puts the request's Cloudflare context on globalThis) the bucket
 * must be bound, or uploads stop with an error rather than going nowhere.
 */
export function evidenceStore(): EvidenceStore {
  if (override) return override;
  const context = (globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined>)[
    Symbol.for("__cloudflare-context__")
  ];
  if (context) {
    const bucket = context.env?.EVIDENCE_BUCKET as R2BucketLike | undefined;
    if (!bucket) throw new Error("EVIDENCE_BUCKET is not bound: report screenshots have nowhere to go");
    return r2Store(bucket);
  }
  return fileStore(process.env.ZG_EVIDENCE_DIR || `${process.cwd()}/data/uploads/report-evidence`);
}

/** A store in memory, for tests. */
export function memoryStore(): EvidenceStore & { keys(): string[] } {
  const files = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) {
      files.set(checked(key), bytes);
    },
    async get(key) {
      const bytes = files.get(checked(key));
      return bytes && new Uint8Array(bytes);
    },
    async remove(keys) {
      for (const key of keys) files.delete(key);
    },
    keys: () => [...files.keys()],
  };
}
