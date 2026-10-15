/**
 * Writes the ERP's operational reports into a Google Sheet, one tab each:
 * 摘要, 庫存, 盤點紀錄, 盤差明細 (latest completed count), 月營收, 再行銷名單.
 *
 * Runs outside a request (CLI, daily scheduler), so labels are fixed zh-TW
 * rather than coming from the visitor's locale cookie.
 */
import type { CountStatus, MemberSegment, VarianceReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stockFlags, type StockFlag } from "@/lib/inventory";
import { REMARKETING_SEGMENTS, type RemarketingKey } from "@/lib/remarketing";
import { removeEmptyDefaultSheets, writeSheet } from "./sheets";

/** Leading apostrophe keeps Sheets from turning "0912345678" / "10101014" into numbers. */
const text = (v: string) => `'${v}`;

const COUNT_STATUS: Record<CountStatus, string> = { DRAFT: "草稿", IN_PROGRESS: "盤點中", PAUSED: "已暫停", COMPLETED: "已完成" };
const FLAG: Record<StockFlag, string> = { low: "低於安全庫存", mismatch: "POS 與門市不符", high: "庫存過多" };
const SEGMENT: Record<MemberSegment, string> = { NEW: "新會員", ACTIVE: "活躍", RETURNING: "回購", INACTIVE: "久未消費" };
const REMARKETING: Record<RemarketingKey, string> = { new: "新會員", returning: "回購會員", high_value: "高價值會員", dormant_90: "90 天未消費" };
const REASON: Record<VarianceReason, string> = {
  DAMAGED: "商品毀損",
  EXPIRED: "過期報廢",
  THEFT: "疑似失竊",
  MISCOUNT: "點數錯誤",
  SYSTEM_ERROR: "系統錯誤",
  UNRECORDED_SALE: "未入帳銷售",
  SUPPLIER_SHORTAGE: "廠商短交",
  OTHER: "其他",
};

/** Asia/Taipei "2026/10/15 08:30" (or date only), as text Sheets parses as a date. */
function tw(d: Date | null | undefined, withTime = false) {
  if (!d) return "";
  const l = new Date(d.getTime() + 8 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${l.getUTCFullYear()}/${p(l.getUTCMonth() + 1)}/${p(l.getUTCDate())}`;
  return withTime ? `${date} ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}` : date;
}

export interface ExportResult {
  tabs: { title: string; rows: number }[];
  exportedAt: Date;
}

export async function exportReportsToSheet(spreadsheet: string, source: string): Promise<ExportResult> {
  const now = new Date();

  // ── 庫存 ──
  const inventory = await prisma.inventory.findMany({
    where: { product: { isActive: true } },
    include: { product: { include: { category: true, location: true } } },
    orderBy: { product: { sku: "asc" } },
  });
  const stockRows = [
    ["SKU", "品名", "分類", "單位", "儲位", "POS 庫存", "門市庫存", "差異 (POS−門市)", "物流中心", "安全庫存", "狀態"],
    ...inventory.map((i) => {
      const flags = stockFlags(i);
      return [
        text(i.product.sku),
        i.product.name,
        i.product.category.name,
        i.product.unit ?? "件",
        i.product.location?.code ?? "",
        i.posStock,
        i.storeStock,
        i.posStock - i.storeStock,
        i.warehouseStock,
        i.safetyStock,
        flags.length ? flags.map((f) => FLAG[f]).join("、") : "正常",
      ];
    }),
  ];

  // ── 盤點紀錄 ──
  const sessions = await prisma.inventoryCountSession.findMany({ orderBy: { countDate: "desc" } });
  const sessionRows = [
    ["盤點單", "盤點日期", "狀態", "操作人員", "範圍", "已盤", "未盤", "總盤差", "開始", "完成"],
    ...sessions.map((s) => [
      s.code,
      tw(s.countDate),
      COUNT_STATUS[s.status],
      s.operator,
      s.zones.length ? `儲位區 ${s.zones.join(", ")}` : "全店",
      s.countedCount,
      s.uncountedCount,
      s.totalVariance,
      tw(s.startedAt, true),
      tw(s.completedAt, true),
    ]),
  ];

  // ── 盤差明細（最近一次完成的盤點）──
  const latest = sessions.find((s) => s.status === "COMPLETED");
  const varianceItems = latest
    ? await prisma.inventoryCountItem.findMany({
        where: { sessionId: latest.id, NOT: { variance: 0 } },
        include: { product: true },
        orderBy: [{ locationCode: "asc" }],
      })
    : [];
  const varianceRows = [
    ["盤點單", "儲位", "SKU", "品名", "單位", "POS 庫存", "實盤", "盤差 (POS−實盤)", "盤損金額", "原因", "備註"],
    ...varianceItems.map((i) => [
      latest!.code,
      i.locationCode ?? "",
      text(i.product.sku),
      i.product.name,
      i.product.unit ?? "件",
      i.posQty,
      i.actualQty,
      i.variance,
      (i.variance ?? 0) * i.product.price,
      i.reason ? REASON[i.reason] : "",
      i.note ?? "",
    ]),
  ];

  // ── 月營收 ──
  const monthly = await prisma.$queryRaw<{ month: string; revenue: number; orders: number; member_orders: number }[]>`
    SELECT to_char(date_trunc('month', "orderedAt" AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM') AS month,
           SUM(total)::int AS revenue, COUNT(*)::int AS orders, COUNT("memberId")::int AS member_orders
    FROM "Order" GROUP BY 1 ORDER BY 1`;
  const monthlyRows = [
    ["月份", "營收", "訂單數", "客單價", "會員訂單數", "會員訂單佔比"],
    ...monthly.map((m) => [
      m.month,
      m.revenue,
      m.orders,
      m.orders ? Math.round(m.revenue / m.orders) : 0,
      m.member_orders,
      m.orders ? `${((m.member_orders / m.orders) * 100).toFixed(1)}%` : "",
    ]),
  ];

  // ── 再行銷名單 ──
  const remarketingRows: (string | number)[][] = [["分群", "會員編號", "姓名", "手機", "Email", "會員分類", "最近消費", "消費次數", "累積消費", "平均客單價"]];
  for (const seg of REMARKETING_SEGMENTS) {
    const members = await prisma.member.findMany({ where: seg.where(now), orderBy: { totalSpent: "desc" } });
    for (const m of members) {
      remarketingRows.push([
        REMARKETING[seg.key],
        m.memberNumber,
        m.name,
        text(m.phone),
        m.email ?? "",
        SEGMENT[m.segment],
        tw(m.lastPurchaseAt),
        m.purchaseCount,
        m.totalSpent,
        m.avgOrderValue,
      ]);
    }
  }

  const tabs: [string, (string | number | null)[][]][] = [
    ["庫存", stockRows],
    ["盤點紀錄", sessionRows],
    ["盤差明細", varianceRows],
    ["月營收", monthlyRows],
    ["再行銷名單", remarketingRows],
  ];
  const summary: (string | number)[][] = [
    ["項目", "內容"],
    ["匯出時間", tw(now, true)],
    ["資料來源", source],
    ["盤差明細的盤點單", latest ? `${latest.code}（${tw(latest.countDate)}）` : "尚無已完成盤點"],
    ...tabs.map(([title, rows]): [string, number] => [`「${title}」筆數`, rows.length - 1]),
  ];

  // summary first so it is the leftmost new tab on a fresh spreadsheet
  for (const [title, rows] of [["摘要", summary] as [string, (string | number | null)[][]], ...tabs]) {
    await writeSheet(spreadsheet, title, rows);
  }
  await removeEmptyDefaultSheets(spreadsheet);
  return { tabs: tabs.map(([title, rows]) => ({ title, rows: rows.length - 1 })), exportedAt: now };
}
