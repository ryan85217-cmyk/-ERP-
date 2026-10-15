import { timingSafeEqual } from "node:crypto";
import { generateTransactions, MOCK_STORE_ID } from "@/lib/mock-pos/generator";
import { posCatalog } from "@/lib/mock-pos/catalog";

export const dynamic = "force-dynamic";

/**
 * Simulated third-party POS API (stands in for a real POS vendor's API in demos).
 *   GET /api/mock-pos/v1/transactions?since=ISO&until=ISO   (Authorization: Bearer MOCK_POS_TOKEN, default INTEGRATION_TOKEN)
 * Returns till transactions sold in [since, until), max 24 h per call.
 */
export async function GET(req: Request) {
  // a real POS vendor would issue its own key; the demo falls back to the integration token
  const expected = process.env.MOCK_POS_TOKEN || process.env.INTEGRATION_TOKEN;
  if (!expected) return Response.json({ error: "Mock POS is disabled (MOCK_POS_TOKEN)" }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  // an unencoded "+08:00" arrives as " 08:00"
  const time = (v: string | null) => (v ? new Date(v.replace(" ", "+")) : null);
  const since = time(params.get("since")) ?? new Date(NaN);
  const until = time(params.get("until")) ?? new Date();
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || until <= since) {
    return Response.json({ error: "since / until must be ISO timestamps with since < until" }, { status: 400 });
  }
  const { catalog, memberCards } = await posCatalog();
  const transactions = generateTransactions(since, until, catalog, memberCards);
  return Response.json({ store_id: MOCK_STORE_ID, since: since.toISOString(), until: until.toISOString(), count: transactions.length, transactions });
}
