import { checkIntegrationToken } from "@/lib/integrations/auth";
import { dailySummaryReport } from "@/lib/integrations/reports";

export const dynamic = "force-dynamic";

/** GET /api/integrations/daily-summary?date=YYYY-MM-DD — one day's KPIs (default: yesterday, Asia/Taipei). */
export async function GET(req: Request) {
  const denied = checkIntegrationToken(req);
  if (denied) return denied;
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  return Response.json(await dailySummaryReport(date));
}
