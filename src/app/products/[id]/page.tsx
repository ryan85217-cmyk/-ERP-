import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Pencil, Power } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteProduct, toggleProductActive } from "@/lib/actions/products";
import { addDays, startOfDay } from "@/lib/dates";
import { LOCATION_TYPE_VARIANT } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatMonthDay, formatNumber, formatPercent } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductThumb } from "@/components/shared/product-thumb";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { SimpleBarChart } from "@/components/charts/charts";

export const generateMetadata = () => pageTitle((t) => t.products.detailTitle);
export const dynamic = "force-dynamic";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 whitespace-pre-wrap">{children ?? "—"}</dd>
    </div>
  );
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const p = t.products;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: true,
      inventory: true,
      location: { include: { products: { select: { inventory: { select: { storeStock: true } } } } } },
      countItems: {
        where: { actualQty: { not: null } },
        include: { session: true },
        orderBy: { session: { countDate: "desc" } },
        take: 8,
      },
    },
  });
  if (!product) notFound();

  const since = addDays(startOfDay(), -29);
  const [sales30, salesAll, daily] = await Promise.all([
    prisma.orderItem.aggregate({
      where: { productId: id, order: { orderedAt: { gte: since } } },
      _sum: { quantity: true, subtotal: true },
    }),
    prisma.orderItem.aggregate({ where: { productId: id }, _sum: { quantity: true, subtotal: true } }),
    prisma.$queryRaw<{ bucket: string; qty: bigint }[]>`
      SELECT to_char(date_trunc('day', ((o."orderedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')), 'YYYY-MM-DD') AS bucket,
             SUM(oi."quantity")::bigint AS qty
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE oi."productId" = ${id} AND o."orderedAt" >= ${since.toISOString()}::timestamp
      GROUP BY 1 ORDER BY 1`,
  ]);
  const inv = product.inventory;
  const name = localName(locale, product);
  const dailyMap = new Map(daily.map((d) => [d.bucket, Number(d.qty)]));
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(since, i);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
    return { label: formatMonthDay(d, locale), quantity: dailyMap.get(key) ?? 0 };
  });

  const loc = product.location;
  const locQty = loc ? loc.products.reduce((a, x) => a + (x.inventory?.storeStock ?? 0), 0) : 0;
  const locUsage = loc?.capacity ? locQty / loc.capacity : null;

  return (
    <>
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{product.sku}</span>
            <Badge variant="secondary">{localName(locale, product.category)}</Badge>
            {loc && (
              <Badge variant="outline" className="font-mono">
                <MapPin className="size-3" /> {loc.code}
              </Badge>
            )}
            {product.isActive ? <Badge variant="success">{t.common.active}</Badge> : <Badge variant="secondary">{t.common.inactive}</Badge>}
            {name !== product.name && <span className="text-muted-foreground">{product.name}</span>}
          </span>
        }
        backHref="/products"
        actions={
          <>
            <form action={toggleProductActive.bind(null, product.id)}>
              <Button variant="outline" size="sm" type="submit">
                <Power /> {product.isActive ? p.deactivate : p.activate}
              </Button>
            </form>
            <Button size="sm" asChild>
              <Link href={`/products/${product.id}/edit`}>
                <Pencil /> {t.common.edit}
              </Link>
            </Button>
            <ConfirmDelete
              title={fmt(t.common.deleteNamed, { name })}
              description={p.deleteDesc}
              action={deleteProduct.bind(null, product.id, "/products")}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="flex aspect-[4/3] items-center justify-center bg-muted/40">
              <ProductThumb
                name={name}
                imageUrl={product.imageUrl}
                colorKey={product.category.name}
                className="size-full rounded-none border-0 text-6xl"
              />
            </div>
            <CardContent className="grid grid-cols-2 gap-4 pt-5">
              <div>
                <p className="text-xs text-muted-foreground">{p.price}</p>
                <p className="text-xl font-semibold">{formatCurrency(product.price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{p.sales30}</p>
                <p className="text-xl font-semibold">{formatNumber(sales30._sum.quantity ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{p.revenue30}</p>
                <p className="font-semibold">{formatCurrency(sales30._sum.subtotal ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{p.revenueTotal}</p>
                <p className="font-semibold">{formatCurrency(salesAll._sum.subtotal ?? 0)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{p.stockStatus}</CardTitle>
              <CardDescription>{fmt(p.lastSync, { time: formatDateTime(inv?.lastSyncedAt, locale) })}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[
                { label: p.posStockLong, value: inv?.posStock ?? 0 },
                { label: p.storeStock, value: inv?.storeStock ?? 0 },
                { label: p.warehouseStock, value: inv?.warehouseStock ?? 0 },
                { label: p.safetyStock, value: inv?.safetyStock ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(s.value)}</p>
                </div>
              ))}
              {inv && inv.storeStock < inv.safetyStock && (
                <p className="col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {fmt(p.lowWarn, { n: inv.safetyStock * 2 - inv.storeStock })}
                </p>
              )}
              {inv && inv.storeStock !== inv.posStock && (
                <p className="col-span-2 rounded-md bg-warning/15 px-3 py-2 text-sm">{fmt(p.mismatchWarn, { n: inv.posStock - inv.storeStock })}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4" /> {p.locationCard}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {loc ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/locations/${loc.id}`} className="font-mono text-lg font-semibold text-primary hover:underline">
                      {loc.code}
                    </Link>
                    <Badge variant={LOCATION_TYPE_VARIANT[loc.type]}>{t.enums.locationType[loc.type]}</Badge>
                  </div>
                  {locUsage !== null && (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {fmt(p.locationUsage, { pct: formatPercent(locUsage, 0), qty: locQty, cap: loc.capacity })}
                      </p>
                      <Progress value={Math.min(100, locUsage * 100)} barClassName={locUsage > 1 ? "bg-destructive" : undefined} />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">{p.locationEmpty}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{p.infoTitle}</CardTitle>
              {p.contentLangNote && <CardDescription>{p.contentLangNote}</CardDescription>}
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <InfoRow label={p.category}>{localName(locale, product.category)}</InfoRow>
                <InfoRow label={p.unit}>{product.unit}</InfoRow>
                <InfoRow label={p.origin}>{product.origin}</InfoRow>
                <InfoRow label={t.common.supplier}>
                  {product.supplier ? (
                    <Link href={`/suppliers/${product.supplier.id}/edit`} className="text-primary hover:underline">
                      {product.supplier.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </InfoRow>
                <InfoRow label={p.ingredients}>{product.ingredients}</InfoRow>
                <InfoRow label={p.cookingMethod}>{product.cookingMethod}</InfoRow>
                <InfoRow label={p.recipe}>{product.recipe}</InfoRow>
                <InfoRow label={p.createdAt}>{formatDateTime(product.createdAt, locale)}</InfoRow>
                <InfoRow label={p.updatedAt}>{formatDateTime(product.updatedAt, locale)}</InfoRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{p.daily30}</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={dailyData} series={[{ key: "quantity", label: p.quantity }]} format="number" height={220} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{p.countHistory}</CardTitle>
              <CardDescription>{p.countHistoryDesc}</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{p.colCountCode}</TableHead>
                  <TableHead>{t.common.date}</TableHead>
                  <TableHead>{p.colLocation}</TableHead>
                  <TableHead className="text-right">POS</TableHead>
                  <TableHead className="text-right">{p.colActual}</TableHead>
                  <TableHead className="text-right">{p.colVariance}</TableHead>
                  <TableHead>{p.colReason}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.countItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {p.noCounts}
                    </TableCell>
                  </TableRow>
                )}
                {product.countItems.map((ci) => (
                  <TableRow key={ci.id}>
                    <TableCell>
                      <Link href={`/inventory-count/${ci.sessionId}`} className="font-mono text-xs text-primary hover:underline">
                        {ci.session.code}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.enums.countStatus[ci.session.status]}</div>
                    </TableCell>
                    <TableCell>{formatDate(ci.session.countDate, locale)}</TableCell>
                    <TableCell className="font-mono text-xs">{ci.locationCode ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{ci.posQty}</TableCell>
                    <TableCell className="text-right tabular-nums">{ci.actualQty}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${ci.variance ? "text-destructive" : ""}`}>
                      {ci.variance}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ci.reason ? t.enums.reason[ci.reason] : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
