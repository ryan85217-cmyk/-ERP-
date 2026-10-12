import Link from "next/link";
import { AlertTriangle, ClipboardCheck, PackageX, TrendingDown } from "lucide-react";
import type { VarianceReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVarianceByReason, getVarianceByZone, getVarianceRanking } from "@/lib/analytics";
import { formatCurrency, formatMonthDay } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DonutChart, SimpleBarChart } from "@/components/charts/charts";

export const generateMetadata = () => pageTitle((t) => t.nav.countAnalysis);
export const dynamic = "force-dynamic";

export default async function VarianceAnalysisPage() {
  const { t, locale } = await getI18n();
  const c = t.count;
  const [ranking, byReason, byZone, sessions] = await Promise.all([
    getVarianceRanking(15),
    getVarianceByReason(),
    getVarianceByZone(),
    prisma.inventoryCountSession.findMany({
      where: { status: "COMPLETED" },
      orderBy: { countDate: "asc" },
      include: { items: { select: { variance: true, product: { select: { price: true } } } } },
    }),
  ]);

  const sessionTrend = sessions.map((s) => {
    const loss = s.items.reduce((a, i) => a + (i.variance ?? 0) * i.product.price, 0);
    const abs = s.items.reduce((a, i) => a + Math.abs(i.variance ?? 0), 0);
    return { label: formatMonthDay(s.countDate, locale), code: s.code, variance: s.totalVariance, abs, loss };
  });
  const totalLoss = sessionTrend.reduce((a, s) => a + s.loss, 0);
  const totalAbs = sessionTrend.reduce((a, s) => a + s.abs, 0);
  const avgAccuracy = sessions.length
    ? sessions.reduce((a, s) => {
        const ok = s.items.filter((i) => i.variance === 0).length;
        return a + (s.items.length ? ok / s.items.length : 1);
      }, 0) / sessions.length
    : 1;

  return (
    <>
      <PageHeader title={t.nav.countAnalysis} description={fmt(c.analysisDesc, { n: sessions.length })} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={c.completedCount} value={sessions.length} icon={ClipboardCheck} />
        <StatCard label={c.totalAbs} value={totalAbs} icon={PackageX} tone="warning" />
        <StatCard label={c.totalLoss} value={formatCurrency(totalLoss)} icon={TrendingDown} tone="destructive" />
        <StatCard label={c.accuracy} value={`${(avgAccuracy * 100).toFixed(1)}%`} icon={AlertTriangle} tone="success" hint={c.accuracyHint} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{c.rankingTitle}</CardTitle>
            <CardDescription>{c.rankingDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={ranking.slice(0, 10).map((r) => ({ label: localName(locale, r), abs: r.absVariance }))}
              series={[{ key: "abs", label: c.varianceQty, color: "var(--chart-4)" }]}
              format="number"
              horizontal
              height={340}
            />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{c.reasonsTitle}</CardTitle>
            <CardDescription>{c.reasonsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={byReason.map((r) => ({ name: t.enums.reason[r.reason as VarianceReason] ?? r.reason, value: r.qty }))}
              format="number"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{c.zoneTitle}</CardTitle>
            <CardDescription>{c.zoneDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={byZone.map((z) => ({ label: fmt(c.zoneLabel, { zone: z.zone }), abs: z.absVariance }))}
              series={[{ key: "abs", label: c.varianceQty, color: "var(--chart-4)" }]}
              format="number"
              height={220}
            />
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {byZone.map((z) => (
                <div key={z.zone} className="rounded-md bg-muted/60 p-2 text-center">
                  <div className="font-mono text-xs text-muted-foreground">{z.zone}</div>
                  <div className={`text-sm font-semibold ${z.accuracy < 0.8 ? "text-destructive" : ""}`}>{(z.accuracy * 100).toFixed(0)}%</div>
                  <div className="text-[10px] text-muted-foreground">{c.zoneAccuracy}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{c.lossPerSession}</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={sessionTrend} series={[{ key: "loss", label: c.colLoss, color: "var(--chart-4)" }]} height={300} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.detailRanking}</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t.common.product}</TableHead>
              <TableHead>{c.colLocation}</TableHead>
              <TableHead className="text-right">{c.colOccurrences}</TableHead>
              <TableHead className="text-right">{c.colAbs}</TableHead>
              <TableHead className="text-right">{c.colNet}</TableHead>
              <TableHead className="text-right">{c.colLoss}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((r, idx) => (
              <TableRow key={r.productId}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <Link href={`/products/${r.productId}`} className="font-medium hover:underline">
                    {localName(locale, r)}
                  </Link>
                  <div className="font-mono text-xs text-muted-foreground">{r.sku}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.locationCode ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.occurrences}</TableCell>
                <TableCell className="text-right tabular-nums">{r.absVariance}</TableCell>
                <TableCell className="text-right tabular-nums">{r.netVariance}</TableCell>
                <TableCell className="text-right font-medium tabular-nums text-destructive">{formatCurrency(r.lossAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
