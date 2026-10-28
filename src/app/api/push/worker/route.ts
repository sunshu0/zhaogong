import { PUSH_WORKER } from "@/lib/push/service-worker";
export function GET() {
  return new Response(PUSH_WORKER, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}
