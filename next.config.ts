import type { NextConfig } from "next";

// Next's default list of bots that need metadata in <head> (next/dist/shared/lib/router/utils/html-bots.js),
// plus the Chinese apps our job links are shared in. MicroMessenger also matches WeChat's in-app browser,
// so people opening a job from WeChat get a blocking render instead of streamed metadata.
const HTML_LIMITED_BOTS =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|MicroMessenger|QQ\/|MQQBrowser|Weibo|xiaohongshu|XHS/i;

// The browser tests' build (#139): ZG_E2E=1 at `next build` turns on the development helpers (src/lib/test-build.ts).
// `env` writes the value into the code at build time, so a deployment built without it cannot turn them on later.
// The build goes to its own folder, apart from the development server's and the deployment's.
const testBuild = process.env.ZG_E2E === "1";
// OpenNext builds the Cloudflare deployment in standalone mode: a shell that still has ZG_E2E set stops here.
if (testBuild && process.env.NEXT_PRIVATE_STANDALONE === "true")
  throw new Error("ZG_E2E=1 is for the browser tests' build only. Unset it before building the deployment.");

// Security review (10-23): every page and route answers with these. No other site may frame ours (clickjacking on
// /admin, /account/data or a team link), browsers must not guess content types, and a link out sends only our
// origin. A full Content-Security-Policy is later work (ADR 0025 notes Clarity's scripts would need allowing).
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  env: { ZG_E2E: testBuild ? "1" : "0" },
  // tsconfig.e2e.json already lists the folder's types, so the build leaves tsconfig.json as it is; `npm run check`
  // type-checks the same code.
  ...(testBuild && {
    distDir: ".next-e2e",
    typescript: { tsconfigPath: "tsconfig.e2e.json", ignoreBuildErrors: true },
  }),
  // The frontend uses local icons and browser-generated avatars; serve them without an image service.
  images: { unoptimized: true },
  cacheComponents: true,
  // A job report carries up to three 5 MB screenshots (ADR 0027): its Server Function and the proxy in front of the
  // page take a body that size. Every other Server Function checks its own sizes.
  experimental: { serverActions: { bodySizeLimit: "16mb" }, proxyClientMaxBodySize: "16mb" },
  htmlLimitedBots: HTML_LIMITED_BOTS,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
