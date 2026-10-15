import { checkIntegrationToken } from "@/lib/integrations/auth";
import { countCompletedReport } from "@/lib/integrations/reports";

export const dynamic = "force-dynamic";

/** GET /api/integrations/counts/:id — count summary (same payload the completion webhook sends). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkIntegrationToken(req);
  if (denied) return denied;
  const report = await countCompletedReport((await params).id);
  return report ? Response.json(report) : Response.json({ error: "Not found" }, { status: 404 });
}
