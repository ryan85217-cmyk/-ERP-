import { checkIntegrationToken } from "@/lib/integrations/auth";
import { posCursor } from "@/lib/integrations/pos-ingest";

export const dynamic = "force-dynamic";

/** GET /api/integrations/pos/cursor — the time window the next POS sync should fetch. */
export async function GET(req: Request) {
  const denied = checkIntegrationToken(req);
  if (denied) return denied;
  return Response.json(await posCursor());
}
