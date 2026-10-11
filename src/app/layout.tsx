import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
            <Link href="/" className="text-lg font-semibold text-brand">
              {PRODUCT_NAME}
            </Link>
            <span className="text-sm text-muted">奥克兰</span>
            <nav className="ml-auto flex items-center gap-4 text-sm">
              <Link href="/" className="hover:text-brand">
                找工作
              </Link>
              <Link href="/employer" className="rounded-full bg-brand px-3 py-1.5 font-medium text-white hover:opacity-90">
                发布招聘
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          所有职位须符合当地法律：不低于最低工资，不收取任何费用，不以种族或国籍招人。
        </footer>
      </body>
    </html>
  );
}
