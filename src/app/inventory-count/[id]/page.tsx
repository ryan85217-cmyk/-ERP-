import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Timer, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteCountSession } from "@/lib/actions/inventory-count";
import { COUNT_STATUS_VARIANT } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { StatCard } from "@/components/shared/stat-card";
import { CountSheet } from "./count-sheet";

export const generateMetadata = () => pageTitle((t) => t.nav.count);
export const dynamic = "force-dynamic";

function duration(t: Messages, start: Date | null, end: Date | null) {
  if (!start || !end) return "—";
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  return mins >= 60 ? fmt(t.count.hoursMinutes, { h: Math.floor(mins / 60), m: mins % 60 }) : fmt(t.count.minutes, { m: mins });
}

export default async function CountSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const c = t.count;
  const session = await prisma.inventoryCountSession.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { include: { category: true } }, location: true },
        // walking order: location sequence first, then SKU (items without a location go last)
        orderBy: [{ location: { sortOrder: "asc" } }, { locationCode: "asc" }, { product: { sku: "asc" } }],
      },
    },
  });
  if (!session) notFound();

  const meta = (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Badge variant={COUNT_STATUS_VARIANT[session.status]}>{t.enums.countStatus[session.status]}</Badge>
      <span className="inline-flex items-center gap-1">
        <CalendarDays className="size-3.5" /> {formatDate(session.countDate, locale)}
      </span>
      <span className="inline-flex items-center gap-1">
        <User className="size-3.5" /> {session.operator}
      </span>
      <span className="inline-flex items-center gap-1">
        <MapPin className="size-3.5" /> {session.zones.length ? fmt(c.scopeZones, { zones: session.zones.join(", ") }) : c.scopeAll}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" /> {fmt(c.startedShort, { time: formatDateTime(session.startedAt, locale) })}
      </span>
      {session.completedAt && (
        <span className="inline-flex items-center gap-1">
          <Timer className="size-3.5" /> {fmt(c.completedShort, { time: formatDateTime(session.completedAt, locale) })}
        </span>
      )}
    </span>
  );

  if (session.status === "COMPLETED") {
    const withVar = session.items.filter((i) => i.variance);
    const lossAmount = withVar.reduce((a, i) => a + (i.variance ?? 0) * i.product.price, 0);
    return (
      <>
        <PageHeader title={fmt(c.completedTitle, { code: session.code })} description={meta} backHref="/inventory-count/history" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={c.countedItems} value={session.countedCount} />
          <StatCard label={c.varianceItems} value={withVar.length} tone="warning" />
          <StatCard label={c.totalVarianceQty} value={session.totalVariance} tone="destructive" />
          <StatCard
            label={c.lossAmount}
            value={formatCurrency(lossAmount)}
            tone="destructive"
            hint={fmt(c.duration, { d: duration(t, session.startedAt, session.completedAt) })}
          />
        </div>
        {session.note && <p className="mb-4 rounded-md border bg-card px-4 py-3 text-sm">{fmt(t.common.notePrefix, { note: session.note })}</p>}
        <Card>
          <CardHeader>
            <CardTitle>{c.detailTitle}</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{c.colLocation}</TableHead>
                <TableHead>{t.common.product}</TableHead>
                <TableHead className="hidden md:table-cell">{t.common.category}</TableHead>
                <TableHead className="text-right">{c.colPos}</TableHead>
                <TableHead className="text-right">{c.colActualShort}</TableHead>
                <TableHead className="text-right">{c.variance}</TableHead>
                <TableHead>{c.colReason}</TableHead>
                <TableHead>{t.common.note}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {session.items.map((i) => (
                <TableRow key={i.id} className={i.variance ? "bg-destructive/[0.04]" : undefined}>
                  <TableCell className="font-mono text-xs">{i.locationCode ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/products/${i.productId}`} className="font-medium hover:underline">
                      {localName(locale, i.product)}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{i.product.sku}</div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{localName(locale, i.product.category)}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.posQty}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.actualQty ?? "—"}</TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${i.variance ? (i.variance > 0 ? "text-destructive" : "text-info") : "text-muted-foreground"}`}
                  >
                    {i.variance ?? "—"}
                  </TableCell>
                  <TableCell>{i.reason ? t.enums.reason[i.reason] : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{i.note ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={fmt(c.sessionTitle, { code: session.code })}
        description={meta}
        backHref="/inventory-count"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory-count">{c.backToList}</Link>
            </Button>
            <ConfirmDelete
              label={c.deleteTask}
              title={c.deleteTitle}
              description={c.deleteDesc}
              action={deleteCountSession.bind(null, session.id)}
            />
          </>
        }
      />
      {session.note && (
        <Card className="mb-4">
          <CardContent className="py-3 text-sm">{fmt(t.common.notePrefix, { note: session.note })}</CardContent>
        </Card>
      )}
      <CountSheet
        sessionId={session.id}
        status={session.status}
        items={session.items.map((i) => ({
          id: i.id,
          productName: localName(locale, i.product),
          sku: i.product.sku,
          categoryName: localName(locale, i.product.category),
          colorKey: i.product.category.name,
          imageUrl: i.product.imageUrl,
          locationCode: i.locationCode,
          locationType: i.location ? t.enums.locationType[i.location.type] : null,
          posQty: i.posQty,
          unit: i.product.unit,
          actualQty: i.actualQty,
          reason: i.reason,
          note: i.note,
        }))}
      />
    </>
  );
}
