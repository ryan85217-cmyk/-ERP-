import { checkIntegrationToken } from "@/lib/integrations/auth";
import { lowStockReport } from "@/lib/integrations/reports";

export const dynamic = "force-dynamic";

/** GET /api/integrations/low-stock — products below safety stock, plus a ready-made e-mail. */
export async function GET(req: Request) {
  const denied = checkIntegrationToken(req);
  if (denied) return denied;
  return Response.json(await lowStockReport());
}
