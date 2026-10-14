import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AccountMenu, PostJobLink } from "@/components/seeker/AccountMenu";
import { ChatEntry } from "@/components/seeker/ChatEntry";
import { PRODUCT_NAME } from "@/i18n/labels";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${PRODUCT_NAME} · 奥克兰中文工作`, template: `%s · ${PRODUCT_NAME}` },
  description: "奥克兰的中文工作信息：时薪、地区、签证要求一目了然，雇主经过验证。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        {/* Site-wide install tags must be present before dynamic job metadata streams. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={PRODUCT_NAME} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 sm:gap-4 lg:max-w-[min(72rem,_100vw_-_3rem)] lg:px-0">
            <Link href="/" className="shrink-0 whitespace-nowrap text-lg font-semibold text-brand">
              {PRODUCT_NAME}
            </Link>
            <span className="hidden text-sm text-muted sm:inline">奥克兰</span>
            <nav className="ml-auto flex items-center gap-1 whitespace-nowrap text-sm sm:gap-4">
              <Link href="/jobs" className="inline-flex min-h-11 items-center px-1 hover:text-brand">
                找工作
              </Link>
              <ChatEntry />
              <Link
                href="/workspace"
                className="hidden min-h-11 items-center whitespace-nowrap px-1 font-medium text-brand hover:underline hover:underline-offset-4 sm:inline-flex"
              >
                工作台
              </Link>
              <AccountMenu />
              <PostJobLink className="inline-flex min-h-11 items-center rounded-full bg-brand px-3 py-1.5 font-medium text-white hover:opacity-90" />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-meta text-muted">
          所有职位须符合当地法律：不低于最低工资，不收取任何费用，不以种族或国籍招人。
        </footer>
      </body>
    </html>
  );
}
