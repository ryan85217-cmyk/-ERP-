import Link from "next/link";
import type { CountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COUNT_STATUS_VARIANT } from "@/lib/constants";
import { first, formatDate, formatDateTime } from "@/lib/utils";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoSubmitSelect } from "@/components/shared/auto-submit-select";
import { EmptyState } from "@/components/shared/empty-state";

export const generateMetadata = () => pageTitle((t) => t.nav.countHistory);
export const dynamic = "force-dynamic";

const STATUSES: CountStatus[] = ["DRAFT", "IN_PROGRESS", "PAUSED", "COMPLETED"];

export default async function CountHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const c = t.count;
  const statusParam = first((await searchParams).status) ?? "";
  const status = STATUSES.find((s) => s === statusParam);
  const sessions = await prisma.inventoryCountSession.findMany({
    where: status ? { status } : undefined,
    orderBy: { countDate: "desc" },
  });

  return (
    <>
      <PageHeader title={t.nav.countHistory} description={c.historyDesc} />
      <Card>
        <form method="get" className="flex items-center gap-3 border-b p-4">
          <span className="text-sm text-muted-foreground">{t.common.status}</span>
          <AutoSubmitSelect name="status" defaultValue={statusParam} className="w-40">
            <option value="">{t.common.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.enums.countStatus[s]}
              </option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <Button type="submit" variant="secondary">
              {t.common.filter}
            </Button>
          </noscript>
        </form>
        {sessions.length === 0 ? (
          <EmptyState title={c.empty} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{c.colCode}</TableHead>
                <TableHead>{t.common.date}</TableHead>
                <TableHead>{c.operator}</TableHead>
                <TableHead>{c.colScope}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{c.counted}</TableHead>
                <TableHead className="text-right">{c.uncounted}</TableHead>
                <TableHead className="text-right">{c.colTotalVariance}</TableHead>
                <TableHead className="hidden lg:table-cell">{c.colStart}</TableHead>
                <TableHead className="hidden lg:table-cell">{c.colEnd}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell>{formatDate(s.countDate, locale)}</TableCell>
                  <TableCell>{s.operator}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.zones.length ? s.zones.join(", ") : c.scopeAll}</TableCell>
                  <TableCell>
                    <Badge variant={COUNT_STATUS_VARIANT[s.status]}>{t.enums.countStatus[s.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.countedCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.uncountedCount}</TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${s.totalVariance ? "text-destructive" : ""}`}>
                    {s.totalVariance}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDateTime(s.startedAt, locale)}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDateTime(s.completedAt, locale)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/inventory-count/${s.id}`}>{s.status === "COMPLETED" ? t.common.view : c.resume}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
