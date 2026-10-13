import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// The demo has no ISR or on-demand revalidation; serve build-time cache entries from static assets.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // PPR must resume dynamic content through Next rather than return the cached shell alone.
  enableCacheInterception: false,
});
