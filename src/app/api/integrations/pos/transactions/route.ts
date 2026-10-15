import { revalidatePath } from "next/cache";
import { checkIntegrationToken } from "@/lib/integrations/auth";
import { ingestSchema, ingestTransactions } from "@/lib/integrations/pos-ingest";

export const dynamic = "force-dynamic";

/** POST /api/integrations/pos/transactions — { transactions: [...] } in POS format; idempotent by txn_id. */
export async function POST(req: Request) {
  const denied = checkIntegrationToken(req);
  if (denied) return denied;
  const parsed = ingestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const result = await ingestTransactions(parsed.data);
  if (result.created) {
    revalidatePath("/", "layout");
  }
  return Response.json(result);
}
