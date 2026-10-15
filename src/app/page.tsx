import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  CalendarRange,
  DollarSign,
  MapPin,
  PackageCheck,
  Receipt,
  Repeat,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Warehouse,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getCategoryShare,
  getMonthlyRepurchaseRate,
  getNewMemberCount,
  getNewVsReturning,
  getRevenueSeries,
  getRevenueSummary,
  getTopProducts,
  getVarianceRanking,
  trailingWindow,
  type Granularity,
} from "@/lib/analytics";
import {
  addDays,
  parseRange,
  previousBounds,
  rangeBounds,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  addMonths,
} from "@/lib/dates";
import { stockFlags } from "@/lib/inventory";
import { locationStats } from "@/lib/locations";
import { first, formatCurrency, formatNumber, formatPercent, formatQty } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { RangeTabs } from "@/components/shared/range-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DonutChart, SimpleBarChart, TrendChart } from "@/components/charts/charts";

export const generateMetadata = () => pageTitle((t) => t.nav.dashboard);
export const dynamic = "force-dynamic";

function delta(cur: number, prev: number) {
  if (!prev) return null;
  return (cur - prev) / prev;
}

/** Period-to-date revenue compared with the same elapsed time in the previous period */
async function periodToDate(start: Date, prevStart: Date, now: Date) {
  const elapsed = now.getTime() - start.getTime();
  const [cur, prev] = await Promise.all([
    getRevenueSummary(start, now),
    getRevenueSummary(prevStart, new Date(prevStart.getTime() + elapsed)),
  ]);
  return { ...cur, delta: delta(cur.revenue, prev.revenue) };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const d = t.dashboard;
  const range = parseRange(first((await searchParams).range));
  const rangeLabel = t.enums.range[range];
  const now = new Date();
  const { start, end } = rangeBounds(range, now);
  const prev = previousBounds(start, end);
  const trendUnit: Granularity = range === "today" ? "hour" : range === "year" ? "month" : "day";

  const weekWin = trailingWindow("week", 12, now);
  const monthWin = trailingWindow("month", 12, now);
  const yearWin = trailingWindow("year", 3, now);

  const [
    today,
    week,
    month,
    year,
    summary,
    prevSummary,
    newMembers,
    prevNewMembers,
    customers,
    prevCustomers,
    trend,
    weekly,
    monthly,
    yearly,
    topProducts,
    categoryShare,
    repurchase,
    varianceRanking,
    inventory,
    locations,
  ] = await Promise.all([
    periodToDate(startOfDay(now), addDays(startOfDay(now), -1), now),
    periodToDate(startOfWeek(now), addDays(startOfWeek(now), -7), now),
    periodToDate(startOfMonth(now), addMonths(startOfMonth(now), -1), now),
    periodToDate(startOfYear(now), startOfYear(addDays(startOfYear(now), -1)), now),
    getRevenueSummary(start, end),
    getRevenueSummary(prev.start, prev.end),
    getNewMemberCount(start, end),
    getNewMemberCount(prev.start, prev.end),
    getNewVsReturning(start, end),
    getNewVsReturning(prev.start, prev.end),
    getRevenueSeries(trendUnit, start, end),
    getRevenueSeries("week", weekWin.start, weekWin.end),
    getRevenueSeries("month", monthWin.start, monthWin.end),
    getRevenueSeries("year", yearWin.start, yearWin.end),
    getTopProducts(start, end, 10),
    getCategoryShare(start, end),
    getMonthlyRepurchaseRate(12, now),
    getVarianceRanking(8),
    prisma.inventory.findMany({ where: { product: { isActive: true } }, include: { product: true } }),
    prisma.storageLocation.findMany({
      where: { isActive: true },
      include: { products: { where: { isActive: true }, select: { inventory: { select: { storeStock: true } } } } },
    }),
  ]);
  const locStats = locations.map((l) => ({ code: l.code, id: l.id, capacity: l.capacity, ...locationStats(l, l.products) }));
  const overLocations = locStats.filter((l) => l.band === "over").sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0));
  const emptyLocations = locStats.filter((l) => l.productCount === 0).length;
  const name = (p: { name: string; nameEn?: string | null; nameJa?: string | null }) => localName(locale, p);

  const flagged = inventory.map((i) => ({ ...i, flags: stockFlags(i) }));
  const low = flagged.filter((i) => i.flags.includes("low")).sort((a, b) => a.storeStock - a.safetyStock - (b.storeStock - b.safetyStock));
  const mismatch = flagged.filter((i) => i.flags.includes("mismatch")).sort((a, b) => Math.abs(b.posStock - b.storeStock) - Math.abs(a.posStock - a.storeStock));
  const high = flagged.filter((i) => i.flags.includes("high")).sort((a, b) => b.storeStock / b.safetyStock - a.storeStock / a.safetyStock);
  const warehouseTotal = inventory.reduce((a, i) => a + i.warehouseStock, 0);
  const warehouseValue = inventory.reduce((a, i) => a + i.warehouseStock * i.product.price, 0);

  return (
    <>
      <PageHeader
        title={t.nav.dashboard}
        description={d.desc}
        actions={<RangeTabs value={range} />}
      />

      {/* fixed-period revenue */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={d.todayRevenue} value={formatCurrency(today.revenue)} icon={DollarSign} delta={today.delta} hint={fmt(d.todayHint, { n: today.orders })} />
        <StatCard label={d.weekRevenue} value={formatCurrency(week.revenue)} icon={CalendarDays} tone="info" delta={week.delta} hint={d.weekHint} />
        <StatCard label={d.monthRevenue} value={formatCurrency(month.revenue)} icon={CalendarRange} tone="success" delta={month.delta} hint={d.monthHint} />
        <StatCard label={d.yearRevenue} value={formatCurrency(year.revenue)} icon={TrendingUp} tone="warning" delta={year.delta} hint={d.yearHint} />
      </div>

      {/* range-based KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={fmt(d.orders, { range: rangeLabel })}
          value={formatNumber(summary.orders)}
          icon={ShoppingCart}
          delta={delta(summary.orders, prevSummary.orders)}
          hint={t.common.vsPrev}
        />
        <StatCard
          label={fmt(d.aov, { range: rangeLabel })}
          value={formatCurrency(summary.aov)}
          icon={Receipt}
          tone="info"
          delta={delta(summary.aov, prevSummary.aov)}
          hint={t.common.vsPrev}
        />
        <StatCard
          label={fmt(d.newMembers, { range: rangeLabel })}
          value={formatNumber(newMembers)}
          icon={UserPlus}
          tone="success"
          delta={delta(newMembers, prevNewMembers)}
          hint={t.common.vsPrev}
        />
        <StatCard
          label={fmt(d.returningMembers, { range: rangeLabel })}
          value={formatNumber(customers.returningCustomers)}
          icon={Repeat}
          tone="warning"
          delta={delta(customers.returningCustomers, prevCustomers.returningCustomers)}
          hint={d.returningHint}
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{range === "today" ? d.hourlyToday : range === "year" ? d.monthlyThisYear : d.dailyRevenue}</CardTitle>
              <CardDescription>{fmt(d.rangeRevenue, { range: rangeLabel, amount: formatCurrency(summary.revenue) })}</CardDescription>
            </div>
            <Link href="/analytics/daily" className="text-sm text-primary hover:underline">
              {d.dailyLink}
            </Link>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} series={[{ key: "revenue", label: d.revenue }]} variant="line" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{d.categoryShare}</CardTitle>
            <CardDescription>{rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={categoryShare.map((c) => ({ name: name(c), value: c.value }))} height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{d.weeklyRevenue}</CardTitle>
              <CardDescription>{d.last12Weeks}</CardDescription>
            </div>
            <Link href="/analytics/weekly" className="text-sm text-primary hover:underline">
              {d.weeklyLink}
            </Link>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={weekly} series={[{ key: "revenue", label: d.revenue, color: "var(--chart-2)" }]} height={220} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{d.monthlyRevenue}</CardTitle>
              <CardDescription>{d.last12Months}</CardDescription>
            </div>
            <Link href="/analytics/monthly" className="text-sm text-primary hover:underline">
              {d.monthlyLink}
            </Link>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={monthly} series={[{ key: "revenue", label: d.revenue, color: "var(--chart-1)" }]} height={220} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{d.yearlyRevenue}</CardTitle>
              <CardDescription>{d.last3Years}</CardDescription>
            </div>
            <Link href="/analytics/yearly" className="text-sm text-primary hover:underline">
              {d.yearlyLink}
            </Link>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={yearly} series={[{ key: "revenue", label: d.revenue, color: "var(--chart-3)" }]} height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{d.topProducts}</CardTitle>
            <CardDescription>{fmt(d.topProductsDesc, { range: rangeLabel })}</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{d.noSales}</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <SimpleBarChart
                  data={topProducts.map((p) => ({ label: name(p), revenue: p.revenue }))}
                  series={[{ key: "revenue", label: d.revenue }]}
                  horizontal
                  height={320}
                />
                <ol className="flex flex-col divide-y text-sm">
                  {topProducts.map((p, i) => (
                    <li key={`${p.productId}-${p.name}`} className="flex items-center gap-3 py-2">
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {p.productId ? (
                        <Link href={`/products/${p.productId}`} className="flex-1 truncate hover:underline">
                          {name(p)}
                        </Link>
                      ) : (
                        <span className="flex-1 truncate">{name(p)}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{fmt(t.common.pieces, { n: formatNumber(p.quantity) })}</span>
                      <span className="w-24 text-right font-medium tabular-nums">{formatCurrency(p.revenue)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{d.newVsReturning}</CardTitle>
            <CardDescription>{fmt(d.newVsReturningDesc, { range: rangeLabel })}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DonutChart
              format="number"
              height={180}
              data={[
                { name: d.newCustomers, value: customers.newCustomers },
                { name: d.returningCustomers, value: customers.returningCustomers },
              ]}
            />
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{d.repeatRate}</p>
                <p className="text-xl font-semibold">{formatPercent(customers.repeatRate)}</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{d.guestOrders}</p>
                <p className="text-xl font-semibold">{formatNumber(customers.guestOrders)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{d.monthlyRepurchase}</CardTitle>
            <CardDescription>{d.monthlyRepurchaseDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={repurchase} series={[{ key: "rate", label: d.repurchaseRate, color: "var(--chart-5)" }]} format="percent" height={240} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{d.varianceRanking}</CardTitle>
              <CardDescription>{d.varianceRankingDesc}</CardDescription>
            </div>
            <Link href="/inventory-count/analysis" className="text-sm text-primary hover:underline">
              {d.varianceLink}
            </Link>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={varianceRanking.map((r) => ({ label: name(r), abs: r.absVariance }))}
              series={[{ key: "abs", label: t.count.varianceQty, color: "var(--chart-4)" }]}
              format="number"
              horizontal
              height={240}
            />
          </CardContent>
        </Card>
      </div>

      {/* inventory widgets */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <InventoryWidget
          title={d.lowStock}
          icon={<AlertTriangle className="size-4 text-destructive" />}
          count={low.length}
          href="/inventory/alerts?flag=low"
          emptyText={d.noAlerts}
          moreText={t.common.viewAll}
          rows={low.slice(0, 5).map((i) => ({ href: `/products/${i.productId}`, name: name(i.product), value: fmt(d.lowValue, { qty: i.storeStock, safety: i.safetyStock }) }))}
        />
        <InventoryWidget
          title={d.mismatch}
          icon={<ArrowLeftRight className="size-4 text-[oklch(0.55_0.13_60)]" />}
          count={mismatch.length}
          href="/inventory/alerts?flag=mismatch"
          emptyText={d.noAlerts}
          moreText={t.common.viewAll}
          rows={mismatch.slice(0, 5).map((i) => ({ href: `/products/${i.productId}`, name: name(i.product), value: fmt(d.mismatchValue, { pos: i.posStock, store: i.storeStock }) }))}
        />
        <InventoryWidget
          title={d.highStock}
          icon={<PackageCheck className="size-4 text-info" />}
          count={high.length}
          href="/inventory/alerts?flag=high"
          emptyText={d.noAlerts}
          moreText={t.common.viewAll}
          rows={high.slice(0, 5).map((i) => ({ href: `/products/${i.productId}`, name: name(i.product), value: formatQty(i.storeStock, i.product.unit, t.common.pieces) }))}
        />
        <InventoryWidget
          title={d.locationOver}
          icon={<MapPin className="size-4 text-destructive" />}
          count={overLocations.length}
          href="/locations"
          emptyText={d.noAlerts}
          moreText={d.locationLink}
          footer={`${d.locationEmpty}: ${emptyLocations} / ${locStats.length}`}
          rows={overLocations.slice(0, 5).map((l) => ({
            href: `/locations/${l.id}`,
            name: l.code,
            value: `${l.stock} / ${l.capacity} (${formatPercent(l.usage ?? 0, 0)})`,
            mono: true,
          }))}
        />
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Warehouse className="size-4 text-primary" /> {d.warehouse}
            </CardTitle>
            <Link href="/inventory/warehouse" className="text-xs text-primary hover:underline">
              {t.common.viewLink}
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-3xl font-semibold">{formatNumber(warehouseTotal)}</p>
              <p className="text-xs text-muted-foreground">{d.warehouseUnits}</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{formatCurrency(warehouseValue)}</p>
              <p className="text-xs text-muted-foreground">{d.warehouseValue}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmt(d.warehouseCoverage, { a: low.filter((i) => i.warehouseStock > 0).length, b: low.length })}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InventoryWidget({
  title,
  icon,
  count,
  href,
  rows,
  emptyText,
  moreText,
  footer,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  href: string;
  rows: { href: string; name: string; value: string; mono?: boolean }[];
  emptyText: string;
  moreText: string;
  footer?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {title}
        </CardTitle>
        <Badge variant="secondary">{count}</Badge>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {rows.map((r) => (
              <li key={r.href} className="flex items-center justify-between gap-2 py-2">
                <Link href={r.href} className={`truncate hover:underline ${r.mono ? "font-mono" : ""}`}>
                  {r.name}
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.value}</span>
              </li>
            ))}
          </ul>
        )}
        {footer && <p className="mt-2 text-xs text-muted-foreground">{footer}</p>}
        <Link href={href} className="mt-2 inline-block text-xs text-primary hover:underline">
          {moreText}
        </Link>
      </CardContent>
    </Card>
  );
}
