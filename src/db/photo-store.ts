// Where the shop photos of 企业主页 are kept (ADR 0052 §1): the same kind of store as report screenshots
// (evidence-store.ts), in a bucket of their own so the two never mix. On the Cloudflare deployment an R2 bucket bound
// as PHOTO_BUCKET (docs/cloudflare-deployment.md), elsewhere files under data/uploads/company-photos (data/ is not in
// git). The bucket is not public: /api/company-photos/[id] hands out a photo after checking it may be seen. Server
// only.
import { fileStore, r2Store, type EvidenceStore } from "@/db/evidence-store";

/** The same interface as the report screenshots' store: put, get, remove by a random uuid key. */
export type PhotoStore = EvidenceStore;

let override: PhotoStore | undefined;

/** For tests: use this store (an in-memory one) until called again with undefined. */
export function setPhotoStoreForTests(store: PhotoStore | undefined): void {
  override = store;
}

/**
 * The store for this server. On Workers (OpenNext puts the request's Cloudflare context on globalThis) the bucket
 * must be bound, or uploads stop with an error rather than going nowhere.
 */
export function photoStore(): PhotoStore {
  if (override) return override;
  const context = (globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined>)[
    Symbol.for("__cloudflare-context__")
  ];
  if (context) {
    const bucket = context.env?.PHOTO_BUCKET as Parameters<typeof r2Store>[0] | undefined;
    if (!bucket) throw new Error("PHOTO_BUCKET is not bound: shop photos have nowhere to go");
    return r2Store(bucket);
  }
  return fileStore(process.env.ZG_PHOTO_DIR || `${process.cwd()}/data/uploads/company-photos`);
}
