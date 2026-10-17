export const dynamic = "force-dynamic";

/** Liveness probe for the host (Railway healthcheck); no auth, no data. */
export function GET() {
  return Response.json({ ok: true });
}
