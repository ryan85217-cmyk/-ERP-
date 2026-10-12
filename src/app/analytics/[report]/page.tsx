import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, DollarSign, Receipt, ShoppingCart } from "lucide-react";
import {
  getCategoryShare,
  getRevenueSeries,
  getRevenueSummary,
  getTopProducts,
  trailingWindow,
  type SeriesPoint,
} from "@/lib/analytics";
import { addDays, addMonths, startOfDay, startOfYear } from "@/lib/dates";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DonutChart, SimpleBarChart, TrendChart } from "@/components/charts/charts";

type Report = "daily" | "weekly" | "monthly" | "yearly";

const REPORTS: Record<Report, { unit: "day" | "week" | "month" | "year"; count: number }> = {
  daily: { unit: "day", count: 30 },
  weekly: { unit: "week", count: 12 },
  monthly: { unit: "month", count: 12 },
  yearly: { unit: "year", count: 3 },
};
const REPORT_KEYS = Object.keys(REPORTS) as Report[];

/** Localized labels for one report type. */
function labels(t: Messages, report: Report) {
  const a = t.analytics;
  return {
    daily: { title: t.nav.daily, window: a.windowDaily, period: a.periodDaily, best: a.bestDaily },
    weekly: { title: t.nav.weekly, window: a.windowWeekly, period: a.periodWeekly, best: a.bestWeekly },
    monthly: { title: t.nav.monthly, window: a.windowMonthly, period: a.periodMonthly, best: a.bestMonthly },
    yearly: { title: t.nav.yearly, window: a.windowYearly, period: a.periodYearly, best: a.bestYearly },
  }[report];
}

export async function generateMetadata({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const { t } = await getI18n();
  return { title: REPORT_KEYS.includes(report as Report) ? labels(t, report as Report).title : t.nav.analytics };
}

export const dynamic = "force-dynamic";

export default async function SalesReportPage({ params }: { params: Promise<{ report: string }> }) {
  const { report: reportParam } = await params;
  if (!Object.prototype.hasOwnProperty.call(REPORTS, reportParam)) notFound();
  const report = reportParam as Report;
  const cfg = REPORTS[report];
  const { t, locale } = await getI18n();
  const a = t.analytics;
  const lb = labels(t, report);
  const windowCap = lb.window.charAt(0).toUpperCase() + lb.window.slice(1);
  const now = new Date();
  const { start, end } = trailingWindow(cfg.unit, cfg.count, now);

  const [series, summary, top, categories, extra] = await Promise.all([
    getRevenueSeries(cfg.unit, start, end),
    getRevenueSummary(start, end),
    getTopProducts(start, end, 10),
    getCategoryShare(start, end),
    report === "daily"
      ? getRevenueSeries("hour", startOfDay(now), addDays(startOfDay(now), 1))
      : report === "monthly"
        ? // last year's same months, for YoY comparison
          getRevenueSeries("month", addMonths(start, -12), addMonths(start, 0))
        : Promise.resolve([] as SeriesPoint[]),
  ]);

  const best = series.reduce<SeriesPoint | null>((a, s) => (!a || s.revenue > a.revenue ? s : a), null);
  const rows = series
    .map((s, i) => {
      const prev = i > 0 ? series[i - 1].revenue : 0;
      return { ...s, growth: prev ? (s.revenue - prev) / prev : null };
    })
    .reverse();

  let yoyData: { label: string; thisYear: number; lastYear: number }[] = [];
  if (report === "monthly") {
    yoyData = series.map((s, i) => ({ label: s.label, thisYear: s.revenue, lastYear: extra[i]?.revenue ?? 0 }));
  }
  const ytd = report === "yearly" ? await getRevenueSummary(startOfYear(now), now) : null;

  return (
    <>
      <PageHeader
        title={fmt(a.title, { report: lb.title })}
        description={fmt(a.desc, { window: lb.window })}
        actions={
          <div className="inline-flex rounded-lg border bg-card p-1 shadow-xs">
            {REPORT_KEYS.map((key) => (
              <Link
                key={key}
                href={`/analytics/${key}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  key === report ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {labels(t, key).title}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={fmt(a.windowRevenue, { window: lb.window })}
          value={formatCurrency(summary.revenue)}
          icon={DollarSign}
          hint={ytd ? fmt(a.ytd, { amount: formatCurrency(ytd.revenue) }) : undefined}
        />
        <StatCard label={a.orders} value={formatNumber(summary.orders)} icon={ShoppingCart} tone="info" />
        <StatCard label={a.aov} value={formatCurrency(summary.aov)} icon={Receipt} tone="success" />
        <StatCard label={lb.best} value={best ? best.label : "—"} icon={Award} tone="warning" hint={best ? formatCurrency(best.revenue) : undefined} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{a.trend}</CardTitle>
            <CardDescription>{windowCap}</CardDescription>
          </CardHeader>
          <CardContent>
            {report === "daily" ? (
              <TrendChart data={series} series={[{ key: "revenue", label: a.revenue }]} height={300} />
            ) : (
              <SimpleBarChart data={series} series={[{ key: "revenue", label: a.revenue }]} height={300} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{a.categoryShare}</CardTitle>
            <CardDescription>{windowCap}</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={categories.map((c) => ({ name: localName(locale, c), value: c.value }))} height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{a.ordersAndAov}</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={series} series={[{ key: "orders", label: a.orders, color: "var(--chart-2)" }]} format="number" height={240} />
            <TrendChart data={series} series={[{ key: "aov", label: a.aov, color: "var(--chart-3)" }]} variant="line" height={200} />
          </CardContent>
        </Card>
        {report === "daily" && (
          <Card>
            <CardHeader>
              <CardTitle>{a.hourlyToday}</CardTitle>
              <CardDescription>{a.hourlyDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                data={extra.filter((h) => Number(h.key) >= 8 && Number(h.key) <= 22)}
                series={[{ key: "revenue", label: a.revenue, color: "var(--chart-5)" }]}
                height={440}
              />
            </CardContent>
          </Card>
        )}
        {report === "monthly" && (
          <Card>
            <CardHeader>
              <CardTitle>{a.yoy}</CardTitle>
              <CardDescription>{a.yoyDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={yoyData}
                series={[
                  { key: "thisYear", label: a.thisYear },
                  { key: "lastYear", label: a.lastYear, color: "var(--chart-8)" },
                ]}
                variant="line"
                height={440}
              />
            </CardContent>
          </Card>
        )}
        {(report === "weekly" || report === "yearly") && (
          <Card>
            <CardHeader>
              <CardTitle>{a.topProducts}</CardTitle>
              <CardDescription>{windowCap}</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                data={top.map((p) => ({ label: localName(locale, p), revenue: p.revenue }))}
                series={[{ key: "revenue", label: a.revenue }]}
                horizontal
                height={440}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{fmt(a.detail, { report: lb.title })}</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lb.period}</TableHead>
                <TableHead className="text-right">{a.revenue}</TableHead>
                <TableHead className="text-right">{a.orders}</TableHead>
                <TableHead className="text-right">{a.colAov}</TableHead>
                <TableHead className="text-right">{a.colGrowth}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.orders)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.aov)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      r.growth === null ? "text-muted-foreground" : r.growth >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {r.growth === null ? "—" : `${r.growth >= 0 ? "+" : ""}${(r.growth * 100).toFixed(1)}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{a.top10}</CardTitle>
            <CardDescription>{windowCap}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col divide-y text-sm">
              {top.map((p, i) => (
                <li key={`${p.productId}-${p.name}`} className="flex items-center gap-3 py-2">
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{localName(locale, p)}</span>
                  <span className="text-xs text-muted-foreground">{fmt(t.common.pieces, { n: formatNumber(p.quantity) })}</span>
                  <span className="w-24 text-right font-medium tabular-nums">{formatCurrency(p.revenue)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">{fmt(a.dataSince, { date: formatDate(start, locale) })}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
