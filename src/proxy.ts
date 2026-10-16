// Runs before job pages (Next 16's proxy, formerly middleware). It gives a browser that has none its anonymous
// visitor id with the page itself (#79): the view count used to set it in its own answer, so a reload before that
// answer arrived counted the same browser twice. Only with the page (GET): the job page's Server Functions post to
// the same path, and a cookie set in their answer makes Next refresh the page, dropping a #contact from the address
// (#90).
import { NextResponse, type NextRequest } from "next/server";
import { isProduction } from "@/lib/auth/config";
import { VISITOR_COOKIE, isVisitorId, newVisitorId, visitorCookieOptions } from "@/lib/visitor";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (request.method === "GET" && !isVisitorId(request.cookies.get(VISITOR_COOKIE)?.value)) {
    response.cookies.set(VISITOR_COOKIE, newVisitorId(), visitorCookieOptions(isProduction()));
  }
  return response;
}

export const config = { matcher: "/jobs/:id" };
