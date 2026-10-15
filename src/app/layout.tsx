import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu, HeaderPostJob } from "@/components/seeker/AccountMenu";
import { BottomNav, BottomNavShell } from "@/components/ui/BottomNav";
import { HeaderNav, HeaderNavShell } from "@/components/ui/HeaderNav";
import { PRODUCT_NAME } from "@/i18n/labels";
import "./globals.css";

/** Pay figures and English text (globals.css: font-figure, font-latin). Latin only; Chinese uses the system font. */
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${PRODUCT_NAME} · 奥克兰中文工作`, template: `%s · ${PRODUCT_NAME}` },
  description: "奥克兰的中文工作信息：时薪、地区、签证要求一目了然，雇主经过验证。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
  // Lets the bottom bar pad itself for the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${archivo.variable} h-full antialiased`}>
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
        <header className="sticky top-0 z-20 border-b border-border bg-surface">
          <div className="relative mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 md:gap-4 lg:max-w-[min(72rem,_100vw_-_3rem)] lg:px-0">
            <Link href="/" className="shrink-0 whitespace-nowrap text-lg font-semibold text-brand">
              {PRODUCT_NAME}
            </Link>
            <span className="hidden text-body text-muted md:inline">奥克兰</span>
            <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-body md:gap-4">
              <Suspense fallback={<HeaderNavShell />}>
                <HeaderNav />
              </Suspense>
              <AccountMenu />
              <HeaderPostJob />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-meta text-muted">
          所有职位须符合当地法律：不低于最低工资，不收取任何费用，不以种族或国籍招人。
        </footer>
        <Suspense fallback={<BottomNavShell />}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
