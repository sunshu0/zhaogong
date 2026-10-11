import type { NextConfig } from "next";

// Next's default list of bots that need metadata in <head> (next/dist/shared/lib/router/utils/html-bots.js),
// plus the Chinese apps our job links are shared in. MicroMessenger also matches WeChat's in-app browser,
// so people opening a job from WeChat get a blocking render instead of streamed metadata.
const HTML_LIMITED_BOTS =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|MicroMessenger|QQ\/|MQQBrowser|Weibo|xiaohongshu|XHS/i;

const nextConfig: NextConfig = {
  cacheComponents: true,
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
