/**
 * Report payloads for automation (n8n). Each returns structured data plus a ready-made
 * e-mail `subject` / `html`, so a workflow can simply fetch → (if) → send Gmail.
 */
import { prisma } from "@/lib/prisma";
import { getNewMemberCount, getRevenueSummary, getTopProducts } from "@/lib/analytics";
import { addDays, startOfDay } from "@/lib/dates";
import { stockFlags } from "@/lib/inventory";
import { appUrl, layout, money, num, pct, table } from "./email";

const COUNT_STATUS = { DRAFT: "草稿", IN_PROGRESS: "盤點中", PAUSED: "已暫停", COMPLETED: "已完成" } as const;
const REASON: Record<string, string> = {
  DAMAGED: "商品毀損",
  EXPIRED: "過期報廢",
  THEFT: "疑似失竊",
  MISCOUNT: "點數錯誤",
  SYSTEM_ERROR: "系統錯誤",
  UNRECORDED_SALE: "未入帳銷售",
  SUPPLIER_SHORTAGE: "廠商短交",
  OTHER: "其他",
};

/** "2026/10/15" in Asia/Taipei */
function twDate(d: Date) {
  const l = new Date(d.getTime() + 8 * 3_600_000);
  return `${l.getUTCFullYear()}/${String(l.getUTCMonth() + 1).padStart(2, "0")}/${String(l.getUTCDate()).padStart(2, "0")}`;
}

// ───────────── low stock ─────────────

export async function lowStockReport(limit = 100) {
  const rows = await prisma.inventory.findMany({
    where: { product: { isActive: true } },
    include: { product: { include: { category: true, location: true } } },
  });
  const low = rows
    .filter((r) => stockFlags(r).includes("low"))
    .map((r) => ({
      sku: r.product.sku,
      name: r.product.name,
      category: r.product.category.name,
      unit: r.product.unit ?? "件",
      location: r.product.location?.code ?? null,
      storeStock: r.storeStock,
      safetyStock: r.safetyStock,
      shortage: r.safetyStock - r.storeStock,
      warehouseStock: r.warehouseStock,
      canReplenish: r.warehouseStock > 0,
    }))
    .sort((a, b) => a.storeStock / Math.max(1, a.safetyStock) - b.storeStock / Math.max(1, b.safetyStock));

  const today = twDate(new Date());
  const shown = low.slice(0, limit);
  const subject = low.length ? `【低庫存】${today} 共 ${low.length} 項低於安全庫存` : `【低庫存】${today} 無低庫存商品`;
  const html = layout(
    subject,
    low.length
      ? `<p>以下商品門市庫存低於安全庫存，其中 <b>${low.filter((r) => r.canReplenish).length}</b> 項物流中心有貨可補。</p>` +
          table(
            ["品名", "SKU", "儲位", "門市庫存", "安全庫存", "缺口", "物流中心"],
            shown.map((r) => [r.name, r.sku, r.location ?? "—", `${num(r.storeStock)} ${r.unit}`, num(r.safetyStock), num(r.shortage), num(r.warehouseStock)]),
            [3, 4, 5, 6],
          ) +
          (low.length > shown.length ? `<p>…另有 ${low.length - shown.length} 項，請至系統查看。</p>` : "")
      : "<p>目前所有商品都高於安全庫存。</p>",
    { href: appUrl("/inventory/alerts?flag=low"), label: "到庫存異常頁處理" },
  );
  return { generatedAt: new Date().toISOString(), count: low.length, items: shown, subject, html };
}

// ───────────── daily summary ─────────────

/** `date` = "YYYY-MM-DD" (Asia/Taipei); defaults to yesterday. */
export async function dailySummaryReport(date?: string) {
  const dayStart = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00+08:00`) : addDays(startOfDay(), -1);
  const dayEnd = addDays(dayStart, 1);
  const [day, prevDay, lastWeek, top, newMembers, inventory, activeCounts] = await Promise.all([
    getRevenueSummary(dayStart, dayEnd),
    getRevenueSummary(addDays(dayStart, -1), dayStart),
    getRevenueSummary(addDays(dayStart, -7), addDays(dayEnd, -7)),
    getTopProducts(dayStart, dayEnd, 5),
    getNewMemberCount(dayStart, dayEnd),
    prisma.inventory.findMany({ where: { product: { isActive: true } } }),
    prisma.inventoryCountSession.findMany({ where: { status: { in: ["DRAFT", "IN_PROGRESS", "PAUSED"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const flags = inventory.map(stockFlags);
  const lowStock = flags.filter((f) => f.includes("low")).length;
  const mismatch = flags.filter((f) => f.includes("mismatch")).length;
  const label = twDate(dayStart);

  const subject = `【營運摘要】${label} 營收 ${money(day.revenue)}（${pct(day.revenue, prevDay.revenue)}）`;
  const html = layout(
    `${label} 營運摘要`,
    table(
      ["指標", label, "前一日", "上週同日"],
      [
        ["營收", money(day.revenue), `${money(prevDay.revenue)}（${pct(day.revenue, prevDay.revenue)}）`, `${money(lastWeek.revenue)}（${pct(day.revenue, lastWeek.revenue)}）`],
        ["訂單數", num(day.orders), num(prevDay.orders), num(lastWeek.orders)],
        ["客單價", money(day.aov), money(prevDay.aov), money(lastWeek.aov)],
      ],
      [1, 2, 3],
    ) +
      `<p>新會員 <b>${newMembers}</b> 位　·　低於安全庫存 <b>${lowStock}</b> 項　·　POS 與門市不符 <b>${mismatch}</b> 項</p>` +
      (top.length ? `<h3 style="margin:16px 0 4px">熱銷商品</h3>` + table(["品名", "數量", "營收"], top.map((p) => [p.name, num(p.quantity), money(p.revenue)]), [1, 2]) : "") +
      (activeCounts.length
        ? `<h3 style="margin:16px 0 4px">未完成的盤點</h3>` +
          table(
            ["盤點單", "狀態", "範圍", "進度"],
            activeCounts.map((s) => [
              s.code,
              COUNT_STATUS[s.status],
              s.zones.length ? `儲位區 ${s.zones.join(", ")}` : "全店",
              `${s.countedCount} / ${s.countedCount + s.uncountedCount}`,
            ]),
            [3],
          )
        : ""),
    { href: appUrl("/"), label: "開啟 ERP 儀表板" },
  );
  return {
    date: label,
    revenue: day.revenue,
    orders: day.orders,
    aov: day.aov,
    previousDay: prevDay,
    sameDayLastWeek: lastWeek,
    newMembers,
    lowStock,
    mismatch,
    topProducts: top.map((p) => ({ name: p.name, quantity: p.quantity, revenue: p.revenue })),
    activeCounts: activeCounts.map((s) => ({ code: s.code, status: s.status, zones: s.zones, counted: s.countedCount, total: s.countedCount + s.uncountedCount })),
    subject,
    html,
  };
}

// ───────────── count completed ─────────────

export async function countCompletedReport(sessionId: string) {
  const s = await prisma.inventoryCountSession.findUnique({
    where: { id: sessionId },
    include: { items: { include: { product: true } } },
  });
  if (!s) return null;
  const withVar = s.items.filter((i) => i.variance);
  const lossAmount = withVar.reduce((a, i) => a + Math.max(0, i.variance ?? 0) * i.product.price, 0);
  const top = [...withVar].sort((a, b) => Math.abs(b.variance ?? 0) * b.product.price - Math.abs(a.variance ?? 0) * a.product.price).slice(0, 15);
  const scope = s.zones.length ? `儲位區 ${s.zones.join(", ")}` : "全店";

  const subject = `【盤點完成】${s.code}（${scope}）盤差 ${withVar.length} 項，盤損約 ${money(lossAmount)}`;
  const html = layout(
    `盤點完成：${s.code}`,
    `<p>${twDate(s.countDate)} · ${scope} · 操作人員 ${s.operator}</p>` +
      table(
        ["盤點品項", "有盤差", "總盤差（件）", "盤損金額（售價計）"],
        [[num(s.items.length), num(withVar.length), num(s.totalVariance), money(lossAmount)]],
        [0, 1, 2, 3],
      ) +
      (top.length
        ? `<h3 style="margin:16px 0 4px">主要盤差</h3>` +
          table(
            ["儲位", "品名", "POS", "實盤", "盤差", "原因"],
            top.map((i) => [i.locationCode ?? "—", i.product.name, num(i.posQty), num(i.actualQty ?? 0), num(i.variance ?? 0), i.reason ? REASON[i.reason] : "未填"]),
            [2, 3, 4],
          )
        : "<p>本次盤點沒有任何盤差。</p>"),
    { href: appUrl(`/inventory-count/${s.id}`), label: "查看盤點單" },
  );
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    date: twDate(s.countDate),
    operator: s.operator,
    scope,
    items: s.items.length,
    varianceItems: withVar.length,
    totalVariance: s.totalVariance,
    lossAmount,
    subject,
    html,
  };
}

// ───────────── new POS reports in Drive ─────────────

/**
 * Lists spreadsheets added/updated in POS_REPORTS_FOLDER during the last `hours`.
 * Only a reminder: real store data is imported on the local machine, never by the host.
 */
export async function newReportsReport(hours: number) {
  const folder = process.env.POS_REPORTS_FOLDER;
  if (!folder) throw new Error("POS_REPORTS_FOLDER is not set");
  const { listFolderFiles } = await import("@/lib/google/sheets");
  const since = new Date(Date.now() - hours * 3_600_000);
  const files = (await listFolderFiles(folder, since)).filter((f) => f.mimeType === "application/vnd.google-apps.spreadsheet");
  const fmt = (iso: string) => {
    const l = new Date(new Date(iso).getTime() + 8 * 3_600_000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${l.getUTCFullYear()}/${p(l.getUTCMonth() + 1)}/${p(l.getUTCDate())} ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}`;
  };
  const subject = files.length ? `【新報表】${files.length} 份 POS 報表有更新，記得在本機匯入` : "【新報表】沒有新的 POS 報表";
  const html = layout(
    subject,
    files.length
      ? table(["報表", "更新時間"], files.map((f) => [f.name, fmt(f.modifiedTime)])) +
          `<p>真實門市資料只在你的電腦上處理。請在終端機的 retail-erp 資料夾執行：</p>
<pre style="background:#f3f4f6;padding:10px;border-radius:6px">npm run sheets:import -- real</pre>
<p>若要更新線上展示資料，再執行 <code>npm run sheets:import -- anonymize</code>，檢查後 commit 並 push。</p>`
      : `<p>過去 ${hours} 小時內沒有新的 POS 報表。</p>`,
  );
  return {
    hours,
    count: files.length,
    files: files.map((f) => ({ name: f.name, modifiedTime: f.modifiedTime, link: f.webViewLink })),
    subject,
    html,
  };
}
