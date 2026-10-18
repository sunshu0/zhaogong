import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { StatusCard } from "@/components/seeker/StatusCard";
import { uiMessages } from "@/i18n/messages/ui";
import "./globals.css";

export const metadata: Metadata = { title: "这个页面不存在 · Page not found", robots: { index: false } };

/**
 * A 404 the root layout itself turned away (experimental.globalNotFound in next.config.ts): an address app/[lang]
 * takes for a language that isn't one, such as /favicon.ico, which skipped the proxy. Every other missing address
 * goes through [lang]/[...missing] and gets the card in its own language. This one sits outside app/[lang] and cannot
 * know the language (ADR 0023 §2), so it says everything in both, Chinese first, like global-error.tsx. Plain <a>
 * links: there is no layout to navigate inside.
 */
export default function GlobalNotFound() {
  const zh = uiMessages.zh.notFound;
  const en = uiMessages.en.notFound;
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background px-4 py-10">
        <StatusCard
          icon={SearchX}
          title={
            <>
              {zh.title} <span lang="en">· {en.title}</span>
            </>
          }
          actions={
            <>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- no layout to navigate inside */}
              <a href="/jobs" className="pressable inline-flex min-h-11 items-center px-4 text-body text-brand">
                {zh.findJobs} <span lang="en">· {en.findJobs}</span>
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- no layout to navigate inside */}
              <a href="/" className="pressable inline-flex min-h-11 items-center px-4 text-body text-brand">
                {zh.home} <span lang="en">· {en.home}</span>
              </a>
            </>
          }
        >
          {zh.body}
          <span lang="en" className="mt-1 block">
            {en.body}
          </span>
        </StatusCard>
      </body>
    </html>
  );
}
