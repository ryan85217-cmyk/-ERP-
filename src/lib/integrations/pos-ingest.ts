/**
 * Receives POS till transactions (POS format, e.g. from the mock POS via n8n) and turns
 * them into ERP orders: idempotent by transaction id, decrements POS / store stock and
 * keeps member aggregates and segments current.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { classifyMember } from "@/lib/segments";
import { MOCK_STORE_ID } from "@/lib/mock-pos/generator";

const txnSchema = z.object({
  txn_id: z.string().min(1).max(64),
  sold_at: z.string().datetime(),
  member_card: z.string().nullable().optional(),
  payment: z.string().max(20).optional(),
  lines: z
    .array(z.object({ sku: z.string(), name: z.string().optional(), qty: z.number().int().positive(), unit_price: z.number().int().nonnegative() }))
    .min(1),
});
export const ingestSchema = z.object({ transactions: z.array(txnSchema).max(2000) });

const PAYMENTS = new Set(["CASH", "CARD", "LINE_PAY", "EASY_CARD"]);

/** Where the next sync should start: just after the newest POS transaction already stored. */
export async function posCursor() {
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: `${MOCK_STORE_ID}-` } },
    orderBy: { orderedAt: "desc" },
    select: { orderedAt: true },
  });
  const now = Date.now();
  // first run (or a long outage): don't backfill more than 24 h; default to the last 15 min
  const floor = now - 24 * 3_600_000;
  const since = last ? Math.max(last.orderedAt.getTime() + 1, floor) : now - 15 * 60_000;
  return { since: new Date(since).toISOString(), until: new Date(now).toISOString(), lastTransactionAt: last?.orderedAt.toISOString() ?? null };
}

export async function ingestTransactions(input: z.infer<typeof ingestSchema>) {
  const txns = input.transactions;
  const existing = new Set(
    (await prisma.order.findMany({ where: { orderNumber: { in: txns.map((t) => t.txn_id) } }, select: { orderNumber: true } })).map((o) => o.orderNumber),
  );
  const skus = Array.from(new Set(txns.flatMap((t) => t.lines.map((l) => l.sku))));
  const products = await prisma.product.findMany({ where: { sku: { in: skus } }, include: { category: true } });
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const cards = Array.from(new Set(txns.map((t) => t.member_card).filter((c): c is string => !!c)));
  const members = await prisma.member.findMany({ where: { memberNumber: { in: cards } } });
  const byCard = new Map(members.map((m) => [m.memberNumber, m]));

  let created = 0;
  let revenue = 0;
  const unknownSkus = new Set<string>();
  const touchedMembers = new Set<string>();

  for (const t of [...txns].sort((a, b) => a.sold_at.localeCompare(b.sold_at))) {
    if (existing.has(t.txn_id)) continue;
    existing.add(t.txn_id);
    const lines = t.lines.map((l) => {
      const p = bySku.get(l.sku);
      if (!p) unknownSkus.add(l.sku);
      return { l, p };
    });
    const total = t.lines.reduce((a, l) => a + l.qty * l.unit_price, 0);
    const member = t.member_card ? byCard.get(t.member_card) : undefined;

    await prisma.$transaction([
      prisma.order.create({
        data: {
          orderNumber: t.txn_id,
          orderedAt: new Date(t.sold_at),
          memberId: member?.id ?? null,
          total,
          itemCount: t.lines.reduce((a, l) => a + l.qty, 0),
          paymentMethod: t.payment && PAYMENTS.has(t.payment) ? t.payment : "CASH",
          items: {
            create: lines.map(({ l, p }) => ({
              productId: p?.id ?? null,
              productName: p?.name ?? l.name ?? l.sku,
              categoryName: p?.category.name ?? "未知商品",
              quantity: l.qty,
              unitPrice: l.unit_price,
              subtotal: l.qty * l.unit_price,
            })),
          },
        },
      }),
      // a sale leaves the shelf and the POS ledger at once; never below zero
      ...lines
        .filter(({ p }) => p)
        .map(({ l, p }) =>
          prisma.$executeRaw`UPDATE "Inventory" SET "posStock" = GREATEST(0, "posStock" - ${l.qty}),
            "storeStock" = GREATEST(0, "storeStock" - ${l.qty}), "lastSyncedAt" = NOW(), "updatedAt" = NOW()
            WHERE "productId" = ${p!.id}`,
        ),
    ]);
    created += 1;
    revenue += total;
    if (member) touchedMembers.add(member.id);
  }

  // refresh aggregates for members who bought something
  const now = new Date();
  for (const id of touchedMembers) {
    const agg = await prisma.order.aggregate({ where: { memberId: id }, _count: { _all: true }, _sum: { total: true }, _max: { orderedAt: true } });
    const m = members.find((x) => x.id === id)!;
    const count = agg._count._all;
    const spent = agg._sum.total ?? 0;
    const last = agg._max.orderedAt;
    await prisma.member.update({
      where: { id },
      data: {
        purchaseCount: count,
        totalSpent: spent,
        avgOrderValue: count ? Math.round(spent / count) : 0,
        lastPurchaseAt: last,
        segment: classifyMember({ joinedAt: m.joinedAt, lastPurchaseAt: last, purchaseCount: count }, now),
      },
    });
  }

  return { received: txns.length, created, skipped: txns.length - created, revenue, membersUpdated: touchedMembers.size, unknownSkus: [...unknownSkus] };
}
