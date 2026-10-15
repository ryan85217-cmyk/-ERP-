import { checkIntegrationToken } from "@/lib/integrations/auth";
import { newReportsReport } from "@/lib/integrations/reports";

export const dynamic = "force-dynamic";

/** GET /api/integrations/new-reports?hours=24 — POS reports added or updated in the Drive folder recently. */
export async function GET(req: Request) {
  const denied = checkIntegrationToken(req);
  if (denied) return denied;
  const hours = Math.min(24 * 30, Math.max(1, Number(new URL(req.url).searchParams.get("hours")) || 24));
  try {
    return Response.json(await newReportsReport(hours));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
