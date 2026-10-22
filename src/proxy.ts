// Runs before every page (Next 16's proxy, formerly middleware).
// - The interface language (Round 20, ADR 0023 §2): pages live under app/[lang], one prerendered copy per language.
//   A request is rewritten to the copy in the language of the zg_lang cookie, Chinese without one; the address in
//   the browser keeps no language. An address that carries one (/en/jobs) goes back to the plain one (308).
// - Every page gives a browser that has none its anonymous visitor id with the page itself: job pages since #79
//   (the view count used to set it in its own answer, so a reload before that answer arrived counted the same
//   browser twice), every page since #312 (the funnel events, ADR 0025, join up a visitor's steps). Only with the
//   page (GET): a page's Server Functions post to the same path, and a cookie set in their answer makes Next refresh
//   the page, dropping a #contact from the address (#90). Not with a prefetch either (#312): nobody has opened that
//   page, and a prefetch racing a browser that lost its cookie would hand it a second id. Next takes its own
//   prefetch's headers (next-router-prefetch, rsc) off the request before the proxy sees it, so a page is known by
//   what the browser asks for: HTML. Next's prefetches and in-app moves ask for */* (the #79 test's two ids).
import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, langRoute } from "@/i18n/lang";
import { isProduction } from "@/lib/auth/config";
import { isPrefetch } from "@/lib/events/request";
import { VISITOR_COOKIE, isVisitorId, newVisitorId, visitorCookieOptions } from "@/lib/visitor";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const route = langRoute(pathname, request.cookies.get(LANG_COOKIE)?.value);
  const url = request.nextUrl.clone();
  if ("redirect" in route) {
    url.pathname = route.redirect;
    return NextResponse.redirect(url, 308);
  }
  url.pathname = route.rewrite;
  const response = NextResponse.rewrite(url);
  if (isPageLoad(request) && !isVisitorId(request.cookies.get(VISITOR_COOKIE)?.value)) {
    response.cookies.set(VISITOR_COOKIE, newVisitorId(), visitorCookieOptions(isProduction()));
  }
  return response;
}

/** The browser opening the page itself: a GET for HTML that is not the browser's own prefetch. */
function isPageLoad(request: NextRequest): boolean {
  return (
    request.method === "GET" &&
    (request.headers.get("accept") ?? "").includes("text/html") &&
    !isPrefetch(request.headers)
  );
}

// Every page: not Next's own files, the API, robots.txt, sitemap.xml, or the kinds of file in public/ (icons, the
// manifest; proxy.test.ts checks every file there). Any other address with a dot comes through too, so /favicon.ico
// or /ads.txt gets the 404 in the cookie's language, and an id with a dot still reaches its page.
export const config = { matcher: ["/((?!_next/|api/|robots\\.txt|sitemap\\.xml|.*\\.(?:png|svg|webmanifest)).*)"] };
