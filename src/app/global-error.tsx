"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ErrorFocus } from "@/components/seeker/ErrorFocus";
import { StatusCard } from "@/components/seeker/StatusCard";
import "./globals.css";

/**
 * The root layout itself failed: this replaces it, so it brings its own <html> and <body> (no header or bottom bar).
 * A plain <a> to the home page, so it leaves with a full load instead of through the broken layout. It sits outside
 * app/[lang] and cannot know the page's language (ADR 0023 §2), so it says everything in both, Chinese first.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background px-4 py-10">
        <ErrorFocus>
          <StatusCard
            icon={TriangleAlert}
            title={
              <>
                找工暂时打不开 <span lang="en">· 找工 can&apos;t open right now</span>
              </>
            }
            actions={
              <>
                <Button onClick={() => retry()}>
                  重试 <span lang="en">· Try again</span>
                </Button>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load, past the failed layout */}
                <a href="/" className="pressable inline-flex min-h-11 items-center px-4 text-body text-brand">
                  回首页 <span lang="en">· Home</span>
                </a>
              </>
            }
          >
            可能是网络不稳定，或者我们这边出了错。稍后再试一次。
            <span lang="en" className="mt-1 block">
              The network may be unsteady, or something went wrong on our side. Try again in a moment.
            </span>
          </StatusCard>
        </ErrorFocus>
      </body>
    </html>
  );
}
