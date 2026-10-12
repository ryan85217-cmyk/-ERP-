import Link from "next/link";
import { Download, Lightbulb, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { REMARKETING_SEGMENTS, getRemarketingSegment } from "@/lib/remarketing";
import { HIGH_VALUE_THRESHOLD, SEGMENT_VARIANT } from "@/lib/constants";
import { cn, first, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const generateMetadata = () => pageTitle((t) => t.members.rmTitle);
export const dynamic = "force-dynamic";

export default async function RemarketingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const mt = t.members;
  const text = (key: keyof typeof mt.rm) => ({
    ...mt.rm[key],
    description: fmt(mt.rm[key].description, { n: formatNumber(HIGH_VALUE_THRESHOLD) }),
  });
  const now = new Date();
  const selected = getRemarketingSegment(first((await searchParams).seg)) ?? REMARKETING_SEGMENTS[0];

  const summaries = await Promise.all(
    REMARKETING_SEGMENTS.map(async (s) => {
      const agg = await prisma.member.aggregate({
        where: s.where(now),
        _count: { _all: true },
        _avg: { totalSpent: true, avgOrderValue: true },
        _sum: { totalSpent: true },
      });
      return {
        ...s,
        count: agg._count._all,
        avgSpent: Math.round(agg._avg.totalSpent ?? 0),
        avgOrder: Math.round(agg._avg.avgOrderValue ?? 0),
        totalSpent: agg._sum.totalSpent ?? 0,
      };
    }),
  );
  const totalMembers = await prisma.member.count();
  const members = await prisma.member.findMany({
    where: selected.where(now),
    orderBy: { totalSpent: "desc" },
    take: 50,
  });
  const selectedSummary = summaries.find((s) => s.key === selected.key)!;

  return (
    <>
      <PageHeader
        title={mt.rmTitle}
        description={mt.rmDesc}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map((s) => {
          const active = s.key === selected.key;
          return (
            <Link key={s.key} href={`/members/remarketing?seg=${s.key}`}>
              <Card className={cn("h-full p-5 transition-colors hover:border-primary/60", active && "border-primary ring-2 ring-primary/20")}>
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium">{text(s.key).title}</p>
                  <Users className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{formatNumber(s.count)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmt(mt.rmShare, { pct: totalMembers ? ((s.count / totalMembers) * 100).toFixed(1) : 0, avg: formatCurrency(s.avgSpent) })}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{text(selected.key).title}</CardTitle>
            <CardDescription>{text(selected.key).description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{mt.rmListSize}</dt>
                <dd className="text-lg font-semibold">{formatNumber(selectedSummary.count)}</dd>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{mt.aov}</dt>
                <dd className="text-lg font-semibold">{formatCurrency(selectedSummary.avgOrder)}</dd>
              </div>
              <div className="col-span-2 rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{mt.rmSegmentSpend}</dt>
                <dd className="text-lg font-semibold">{formatCurrency(selectedSummary.totalSpent)}</dd>
              </div>
            </dl>
            <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">{mt.rmSuggestion}</span>
                {text(selected.key).suggestion}
              </p>
            </div>
            <Button asChild variant="outline">
              <a href={`/api/remarketing/${selected.key}`} download>
                <Download /> {mt.rmExport}
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">{mt.rmNoSend}</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{mt.rmPreview}</CardTitle>
            <CardDescription>{mt.rmPreviewDesc}</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{mt.colMember}</TableHead>
                <TableHead className="hidden md:table-cell">{mt.colPhone}</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead>{t.common.category}</TableHead>
                <TableHead>{mt.colLastPurchase}</TableHead>
                <TableHead className="text-right">{mt.rmColTimes}</TableHead>
                <TableHead className="text-right">{mt.colSpent}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {mt.rmEmpty}
                  </TableCell>
                </TableRow>
              )}
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link href={`/members/${m.id}`} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{m.memberNumber}</div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{m.phone}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{m.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={SEGMENT_VARIANT[m.segment]}>{t.enums.segment[m.segment]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.lastPurchaseAt, locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.purchaseCount}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(m.totalSpent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
