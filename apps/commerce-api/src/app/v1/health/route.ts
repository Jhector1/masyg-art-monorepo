export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness only; no DB connectivity or production-readiness claim. */
export function GET(): Response {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
