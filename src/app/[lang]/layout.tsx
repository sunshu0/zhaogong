import type { Metadata, Viewport } from "next";
import { SAFE_X } from "@/components/ui/wide";
import localFont from "next/font/local";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense, type ReactNode } from "react";
import { NotForStaff, StaffRedirect } from "@/components/account/staff";
import { AccountMenu, HeaderPostJob, PostJobLink } from "@/components/seeker/AccountMenu";
import { BottomNav, BottomNavShell } from "@/components/ui/BottomNav";
import { HeaderNavShell } from "@/components/ui/HeaderNav";
import { HeaderNavLive } from "@/components/ui/HeaderNavLive";
import { PreparingMark } from "@/components/external/PreparingMark";
import { HeaderSearch } from "@/components/ui/HeaderSearch";
import { SignInNoticeBar } from "@/components/ui/SignInNoticeBar";
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
  const { site, nav } = await messages(uiMessages);
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
          {/* The first Tab stop, seen only when focused, above the sticky header (UI audits 1 and 2). */}
          <a
            href="#main"
            className="sr-only z-30 rounded-control bg-surface font-medium text-brand shadow-pop focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-3"
          >
            {nav.skip}
          </a>
          <StickyHeader>
            <div
              className={`relative mx-auto flex h-14 max-w-3xl items-center gap-2 ${SAFE_X} md:gap-4 lg:h-16 lg:max-w-[min(72rem,_100vw_-_3rem)] lg:px-0`}
            >
              <Link
                href="/"
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xl font-bold text-brand lg:text-[1.375rem]"
              >
                <BrandMark className="size-8 lg:size-9" />
                <span translate="no">{site.name}</span>
              </Link>
              <span className="hidden text-body text-muted md:inline xl:hidden">{site.city}</span>
              <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-body md:gap-4">
                <Suspense fallback={<HeaderNavShell />}>
                  <HeaderNavLive />
                </Suspense>
                <Suspense fallback={null}>
                  <HeaderSearch />
                </Suspense>
                <LangSwitch />
                <AccountMenu />
                <HeaderPostJob />
              </div>
            </div>
          </StickyHeader>
          <main id="main" tabIndex={-1} className={`mx-auto w-full max-w-3xl flex-1 ${SAFE_X} py-4 outline-none`}>
            <Suspense fallback={null}>
              <SignInNoticeBar />
            </Suspense>
            {children}
          </main>
          {/* Phones: the law note, the legal links, the language switch and 统计设置, centred. From 1024 px four
              columns (V6, #376): the site and its law note, 求职者, 雇主, 法律; the switches under them. */}
          <footer
            data-site-footer=""
            className="border-t border-border px-4 py-6 text-center text-meta text-muted lg:bg-surface lg:py-10 lg:text-left"
          >
            <div className="mx-auto lg:grid lg:max-w-[min(72rem,_100vw_-_3rem)] lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-8">
              <div>
                <Link
                  href="/"
                  className="hidden items-center gap-1.5 text-lg font-bold text-brand lg:inline-flex"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <BrandMark className="size-7" />
                  <span translate="no">{site.name}</span>
                </Link>
                <p className="hidden text-body text-foreground lg:mt-2 lg:block">{footer.tagline}</p>
                <p className="lg:mt-2">{site.lawNote}</p>
              </div>
              <NotForStaff>
                <FooterColumn label={footer.seekers}>
                  <FooterLink href="/jobs">{nav.findJobs}</FooterLink>
                  <FooterLink href="/internships">
                    {nav.internships}
                    <Suspense fallback={null}>
                      <PreparingMark section="internship" />
                    </Suspense>
                  </FooterLink>
                  <FooterLink href="/professional">
                    {nav.professional}
                    <Suspense fallback={null}>
                      <PreparingMark section="professional" />
                    </Suspense>
                  </FooterLink>
                </FooterColumn>
                <FooterColumn label={footer.employers}>
                  <li>
                    <PostJobLink className={FOOTER_LINK} />
                  </li>
                  <FooterLink href="/employer/candidates">{nav.candidates}</FooterLink>
                </FooterColumn>
              </NotForStaff>
              <div>
                <p aria-hidden="true" className="hidden font-semibold text-foreground lg:block">
                  {footer.legal}
                </p>
                <nav aria-label={footer.label} className="flex flex-wrap justify-center gap-x-4 lg:mt-1 lg:block">
                  <Link href="/about" className={FOOTER_LEGAL_LINK}>
                    {footer.about}
                  </Link>
                  <Link href="/safety" className={FOOTER_LEGAL_LINK}>
                    {footer.safety}
                  </Link>
                  <Link href="/privacy" className={FOOTER_LEGAL_LINK}>
                    {footer.privacy}
                  </Link>
                  <Link href="/terms" className={FOOTER_LEGAL_LINK}>
                    {footer.terms}
                  </Link>
                </nav>
              </div>
            </div>
            <div className="mx-auto lg:mt-6 lg:flex lg:max-w-[min(72rem,_100vw_-_3rem)] lg:items-center lg:gap-6 lg:border-t lg:border-border lg:pt-4">
              <LangSwitch look="footer" />
              <ConsentSettingsButton />
            </div>
          </footer>
          <Suspense fallback={<BottomNavShell />}>
            <BottomNav />
          </Suspense>
          {/* ADR 0043: a staff account is sent to 审核后台 from pages it has no use for; reads the path. */}
          <Suspense fallback={null}>
            <StaffRedirect />
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

const FOOTER_LINK = "inline-flex min-h-9 items-center hover:text-brand hover:underline";
/** The legal links: underlined on phones (a row of plain words), a column of links from 1024 px. */
const FOOTER_LEGAL_LINK =
  "inline-flex min-h-11 items-center underline underline-offset-2 lg:flex lg:min-h-9 lg:no-underline lg:hover:text-brand lg:hover:underline";

/** A desktop footer column (#376): a name and its links. Phones keep the short footer, so it is not there. */
function FooterColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="hidden lg:block">
      <p aria-hidden="true" className="font-semibold text-foreground">
        {label}
      </p>
      <ul className="mt-1">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={FOOTER_LINK}>
        {children}
      </Link>
    </li>
  );
}
