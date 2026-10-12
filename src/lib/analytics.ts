import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  addMonths,
  localParts,
  pad2,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "@/lib/dates";

export type Granularity = "hour" | "day" | "week" | "month" | "year";

/** Timestamps are stored as UTC `timestamp(3)`; cast ISO strings to plain timestamp (zone ignored). */
const ts = (d: Date) => Prisma.sql`${d.toISOString()}::timestamp`;
const LOCAL = Prisma.raw(`(("orderedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')`);

const BUCKET_FORMAT: Record<Granularity, string> = {
  hour: "HH24",
  day: "YYYY-MM-DD",
  week: "YYYY-MM-DD",
  month: "YYYY-MM",
  year: "YYYY",
};

// ───────────── revenue ─────────────

export async function getRevenueSummary(start: Date, end: Date) {
  const agg = await prisma.order.aggregate({
    where: { orderedAt: { gte: start, lt: end } },
    _sum: { total: true },
    _count: { _all: true },
  });
  const revenue = agg._sum.total ?? 0;
  const orders = agg._count._all;
  return { revenue, orders, aov: orders ? Math.round(revenue / orders) : 0 };
}

export interface SeriesPoint {
  key: string;
  label: string;
  revenue: number;
  orders: number;
  aov: number;
  [k: string]: string | number;
}

function bucketKeys(unit: Granularity, start: Date, end: Date): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (unit === "hour") {
    for (let h = 0; h < 24; h++) out.push({ key: pad2(h), label: `${pad2(h)}:00` });
    return out;
  }
  if (unit === "day") {
    for (let d = startOfDay(start); d < end; d = addDays(d, 1)) {
      const p = localParts(d);
      out.push({ key: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`, label: `${p.month}/${p.day}` });
    }
    return out;
  }
  if (unit === "week") {
    for (let d = startOfWeek(start); d < end; d = addDays(d, 7)) {
      const p = localParts(d);
      out.push({ key: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`, label: `${p.month}/${p.day}~` });
    }
    return out;
  }
  if (unit === "month") {
    for (let d = startOfMonth(start); d < end; d = addMonths(d, 1)) {
      const p = localParts(d);
      out.push({ key: `${p.year}-${pad2(p.month)}`, label: `${p.year}/${pad2(p.month)}` });
    }
    return out;
  }
  for (let y = localParts(start).year; y <= localParts(addDays(end, -1)).year; y++) out.push({ key: String(y), label: `${y}` });
  return out;
}

export async function getRevenueSeries(unit: Granularity, start: Date, end: Date): Promise<SeriesPoint[]> {
  const trunc = unit === "hour" ? "hour" : unit;
  const rows = await prisma.$queryRaw<{ bucket: string; revenue: bigint; orders: bigint }[]>`
    SELECT to_char(date_trunc(${trunc}, ${LOCAL}), ${BUCKET_FORMAT[unit]}) AS bucket,
           COALESCE(SUM("total"), 0)::bigint AS revenue,
           COUNT(*)::bigint AS orders
    FROM "Order"
    WHERE "orderedAt" >= ${ts(start)} AND "orderedAt" < ${ts(end)}
    GROUP BY 1
    ORDER BY 1`;
  const map = new Map(rows.map((r) => [r.bucket, r]));
  return bucketKeys(unit, start, end).map(({ key, label }) => {
    const r = map.get(key);
    const revenue = r ? Number(r.revenue) : 0;
    const orders = r ? Number(r.orders) : 0;
    return { key, label, revenue, orders, aov: orders ? Math.round(revenue / orders) : 0 };
  });
}

/** Convenience windows for weekly / monthly / yearly overview charts */
export function trailingWindow(unit: Exclude<Granularity, "hour">, count: number, now = new Date()) {
  const end = addDays(startOfDay(now), 1);
  switch (unit) {
    case "day":
      return { start: addDays(startOfDay(now), -(count - 1)), end };
    case "week":
      return { start: addDays(startOfWeek(now), -7 * (count - 1)), end };
    case "month":
      return { start: addMonths(startOfMonth(now), -(count - 1)), end };
    case "year": {
      const y = startOfYear(now);
      return { start: startOfYear(addDays(y, -365 * (count - 1) + 1)), end };
    }
  }
}

// ───────────── products / categories ─────────────

export async function getTopProducts(start: Date, end: Date, limit = 10) {
  const rows = await prisma.$queryRaw<
    { productId: string | null; name: string; nameEn: string | null; nameJa: string | null; quantity: bigint; revenue: bigint }[]
  >`
    SELECT oi."productId", oi."productName" AS name, MAX(p."nameEn") AS "nameEn", MAX(p."nameJa") AS "nameJa",
           SUM(oi."quantity")::bigint AS quantity,
           SUM(oi."subtotal")::bigint AS revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Product" p ON p."id" = oi."productId"
    WHERE o."orderedAt" >= ${ts(start)} AND o."orderedAt" < ${ts(end)}
    GROUP BY oi."productId", oi."productName"
    ORDER BY revenue DESC
    LIMIT ${Prisma.raw(String(Math.max(1, Math.floor(limit))))}`;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    nameEn: r.nameEn,
    nameJa: r.nameJa,
    quantity: Number(r.quantity),
    revenue: Number(r.revenue),
  }));
}

export async function getCategoryShare(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ name: string; nameEn: string | null; nameJa: string | null; value: bigint }[]>`
    SELECT oi."categoryName" AS name, MAX(c."nameEn") AS "nameEn", MAX(c."nameJa") AS "nameJa",
           SUM(oi."subtotal")::bigint AS value
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Category" c ON c."name" = oi."categoryName"
    WHERE o."orderedAt" >= ${ts(start)} AND o."orderedAt" < ${ts(end)}
    GROUP BY 1
    ORDER BY value DESC`;
  return rows.map((r) => ({ name: r.name, nameEn: r.nameEn, nameJa: r.nameJa, value: Number(r.value) }));
}

// ───────────── customers ─────────────

/** Members who purchased in range, split by whether their first-ever order falls inside the range. */
export async function getNewVsReturning(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ new_customers: bigint; returning_customers: bigint; repeat_in_range: bigint; guest_orders: bigint }[]>`
    WITH firsts AS (
      SELECT "memberId", MIN("orderedAt") AS first_at FROM "Order"
      WHERE "memberId" IS NOT NULL GROUP BY 1
    ), inrange AS (
      SELECT "memberId", COUNT(*) AS cnt FROM "Order"
      WHERE "memberId" IS NOT NULL AND "orderedAt" >= ${ts(start)} AND "orderedAt" < ${ts(end)}
      GROUP BY 1
    )
    SELECT
      COUNT(*) FILTER (WHERE f.first_at >= ${ts(start)})::bigint AS new_customers,
      COUNT(*) FILTER (WHERE f.first_at <  ${ts(start)})::bigint AS returning_customers,
      COUNT(*) FILTER (WHERE r.cnt >= 2)::bigint AS repeat_in_range,
      (SELECT COUNT(*) FROM "Order" WHERE "memberId" IS NULL AND "orderedAt" >= ${ts(start)} AND "orderedAt" < ${ts(end)})::bigint AS guest_orders
    FROM inrange r JOIN firsts f USING ("memberId")`;
  const r = rows[0];
  const newCustomers = Number(r?.new_customers ?? 0);
  const returningCustomers = Number(r?.returning_customers ?? 0);
  const active = newCustomers + returningCustomers;
  return {
    newCustomers,
    returningCustomers,
    activeMembers: active,
    guestOrders: Number(r?.guest_orders ?? 0),
    /** share of purchasing members who bought before this period */
    returningShare: active ? returningCustomers / active : 0,
    /** share of purchasing members with ≥ 2 orders inside this period */
    repeatRate: active ? Number(r?.repeat_in_range ?? 0) / active : 0,
  };
}

/** Monthly repurchase rate: members with ≥ 2 orders in month / members with ≥ 1 order in month */
export async function getMonthlyRepurchaseRate(months = 12, now = new Date()) {
  const { start, end } = trailingWindow("month", months, now);
  const rows = await prisma.$queryRaw<{ bucket: string; buyers: bigint; repeaters: bigint }[]>`
    WITH m AS (
      SELECT to_char(date_trunc('month', ${LOCAL}), 'YYYY-MM') AS bucket, "memberId", COUNT(*) AS cnt
      FROM "Order"
      WHERE "memberId" IS NOT NULL AND "orderedAt" >= ${ts(start)} AND "orderedAt" < ${ts(end)}
      GROUP BY 1, 2
    )
    SELECT bucket, COUNT(*)::bigint AS buyers, COUNT(*) FILTER (WHERE cnt >= 2)::bigint AS repeaters
    FROM m GROUP BY 1 ORDER BY 1`;
  const map = new Map(rows.map((r) => [r.bucket, r]));
  return bucketKeys("month", start, end).map(({ key, label }) => {
    const r = map.get(key);
    const buyers = r ? Number(r.buyers) : 0;
    const repeaters = r ? Number(r.repeaters) : 0;
    return { key, label, buyers, repeaters, rate: buyers ? repeaters / buyers : 0 };
  });
}

export async function getNewMemberCount(start: Date, end: Date) {
  return prisma.member.count({ where: { joinedAt: { gte: start, lt: end } } });
}

// ───────────── inventory variance ─────────────

export async function getVarianceRanking(limit = 10, sessionId?: string) {
  const sessionFilter = sessionId
    ? Prisma.sql`AND s."id" = ${sessionId}`
    : Prisma.sql`AND s."status" = 'COMPLETED'`;
  const rows = await prisma.$queryRaw<
    {
      productId: string;
      name: string;
      nameEn: string | null;
      nameJa: string | null;
      sku: string;
      locationCode: string | null;
      abs_variance: bigint;
      net_variance: bigint;
      occurrences: bigint;
      loss_amount: bigint;
    }[]
  >`
    SELECT p."id" AS "productId", p."name", p."nameEn", p."nameJa", p."sku", l."code" AS "locationCode",
           SUM(ABS(i."variance"))::bigint AS abs_variance,
           SUM(i."variance")::bigint AS net_variance,
           COUNT(*) FILTER (WHERE i."variance" <> 0)::bigint AS occurrences,
           SUM(i."variance" * p."price")::bigint AS loss_amount
    FROM "InventoryCountItem" i
    JOIN "InventoryCountSession" s ON s."id" = i."sessionId"
    JOIN "Product" p ON p."id" = i."productId"
    LEFT JOIN "StorageLocation" l ON l."id" = p."locationId"
    WHERE i."variance" IS NOT NULL ${sessionFilter}
    GROUP BY p."id", p."name", p."nameEn", p."nameJa", p."sku", l."code"
    HAVING SUM(ABS(i."variance")) > 0
    ORDER BY abs_variance DESC, loss_amount DESC
    LIMIT ${Prisma.raw(String(Math.max(1, Math.floor(limit))))}`;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    nameEn: r.nameEn,
    nameJa: r.nameJa,
    sku: r.sku,
    locationCode: r.locationCode,
    absVariance: Number(r.abs_variance),
    netVariance: Number(r.net_variance),
    occurrences: Number(r.occurrences),
    lossAmount: Number(r.loss_amount),
  }));
}

/** Variance by storage zone across completed counts (uses the location snapshot on each count line). */
export async function getVarianceByZone() {
  const rows = await prisma.$queryRaw<{ zone: string; abs_variance: bigint; lines: bigint; variance_lines: bigint }[]>`
    SELECT COALESCE(split_part(i."locationCode", '-', 1), '?') AS zone,
           SUM(ABS(i."variance"))::bigint AS abs_variance,
           COUNT(*)::bigint AS lines,
           COUNT(*) FILTER (WHERE i."variance" <> 0)::bigint AS variance_lines
    FROM "InventoryCountItem" i
    JOIN "InventoryCountSession" s ON s."id" = i."sessionId"
    WHERE s."status" = 'COMPLETED' AND i."variance" IS NOT NULL
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({
    zone: r.zone || "?",
    absVariance: Number(r.abs_variance),
    lines: Number(r.lines),
    accuracy: Number(r.lines) ? 1 - Number(r.variance_lines) / Number(r.lines) : 1,
  }));
}

export async function getVarianceByReason() {
  const rows = await prisma.$queryRaw<{ reason: string; qty: bigint; cnt: bigint }[]>`
    SELECT i."reason"::text AS reason, SUM(ABS(i."variance"))::bigint AS qty, COUNT(*)::bigint AS cnt
    FROM "InventoryCountItem" i
    JOIN "InventoryCountSession" s ON s."id" = i."sessionId"
    WHERE s."status" = 'COMPLETED' AND i."variance" IS NOT NULL AND i."variance" <> 0
    GROUP BY 1 ORDER BY qty DESC`;
  return rows.map((r) => ({ reason: r.reason ?? "OTHER", qty: Number(r.qty), count: Number(r.cnt) }));
}
