import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { AccountMenu, HeaderPostJob } from "@/components/seeker/AccountMenu";
import { BottomNav, BottomNavShell } from "@/components/ui/BottomNav";
import { HeaderNav, HeaderNavShell } from "@/components/ui/HeaderNav";
import { StickyHeader } from "@/components/ui/StickyHeader";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { BrandMark } from "@/components/ui/BrandMark";
import { Analytics } from "@/components/analytics/Analytics";
import { ConsentSettingsButton } from "@/components/analytics/ConsentSettingsButton";
import { Toaster } from "@/components/ui/Toast";
import { LangProvider } from "@/i18n/client";
import { aboutMessages } from "@/i18n/messages/about";
import { PRODUCT_NAME } from "@/i18n/labels";
import { LANGS, isLang, localeTag } from "@/i18n/lang";
import { uiMessages } from "@/i18n/messages/ui";
import { messages, serverLang } from "@/i18n/server";
import "../globals.css";

/**
 * Pay figures and English text (globals.css: font-figure, font-latin). Latin only; Chinese uses the system font.
 * #375: a local copy of Archivo's variable Latin file (weight 400–900, width 62–125 %; SIL OFL 1.1, the licence beside
 * it), so neither the build nor the page reaches Google.
 */
const archivo = localFont({
  src: "../fonts/archivo-latin.woff2",
  weight: "400 900",
  variable: "--font-archivo",
  display: "swap",
  declarations: [
    { prop: "font-stretch", value: "62% 125%" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

// Round 20 (ADR 0023 §2): every page is prerendered once per language; the proxy serves the copy the zg_lang cookie
// asks for, at the same address.
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await messages(uiMessages);
  return {
    title: { default: `${PRODUCT_NAME} · ${site.title}`, template: `%s · ${PRODUCT_NAME}` },
    description: site.description,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f5e57",
  // Lets the bottom bar pad itself for the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  // Cache Components has no dynamicParams = false: an address that skipped the proxy (a missing file of a kind it
  // leaves alone, /no-such.png) lands here with that name as the language. Turn it away (Next's own 404) instead of
  // showing the Chinese home page.
  if (!isLang(await rootLang())) notFound();
  const lang = await serverLang();
  const { site } = await messages(uiMessages);
  const { footer } = await messages(aboutMessages);
  return (
    <html lang={localeTag(lang)} className={`${archivo.variable} h-full antialiased`}>
      <head>
        {/* Site-wide install tags must be present before dynamic job metadata streams. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={PRODUCT_NAME} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/favicon-16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body className="min-h-full flex flex-col">
        <LangProvider lang={lang}>
          <StickyHeader>
            <div className="relative mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 md:gap-4 lg:max-w-[min(72rem,_100vw_-_3rem)] lg:px-0">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xl font-bold text-brand"
              >
                <BrandMark className="size-8" />
                {site.name}
              </Link>
              <span className="hidden text-body text-muted md:inline">{site.city}</span>
              <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-body md:gap-4">
                <Suspense fallback={<HeaderNavShell />}>
                  <HeaderNav />
                </Suspense>
                <LangSwitch />
                <AccountMenu />
                <HeaderPostJob />
              </div>
            </div>
          </StickyHeader>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
          <footer className="border-t border-border px-4 py-6 text-center text-meta text-muted">
            <p>{site.lawNote}</p>
            <nav aria-label={footer.label} className="flex flex-wrap justify-center gap-x-4">
              <Link href="/about" className="inline-flex min-h-11 items-center underline underline-offset-2">
                {footer.about}
              </Link>
              <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-2">
                {footer.privacy}
              </Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-2">
                {footer.terms}
              </Link>
            </nav>
            <LangSwitch look="footer" />
            <ConsentSettingsButton />
          </footer>
          <Suspense fallback={<BottomNavShell />}>
            <BottomNav />
          </Suspense>
          <Toaster />
          {/* Clarity behind consent (#313, ADR 0025): reads the path, so inside a Suspense like the navs. */}
          <Suspense fallback={null}>
            <Analytics />
          </Suspense>
        </LangProvider>
      </body>
    </html>
  );
}
