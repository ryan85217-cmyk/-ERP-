import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, Gauge, MapPin, Package, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteLocation } from "@/lib/actions/locations";
import { LOCATION_TYPE_VARIANT } from "@/lib/constants";
import { USAGE_BAR_CLASS, locationStats } from "@/lib/locations";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductThumb } from "@/components/shared/product-thumb";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

export const generateMetadata = () => pageTitle((t) => t.locations.detailTitle);
export const dynamic = "force-dynamic";

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const l = t.locations;
  const loc = await prisma.storageLocation.findUnique({
    where: { id },
    include: {
      products: { include: { inventory: true, category: true }, orderBy: { sku: "asc" } },
      countItems: {
        where: { actualQty: { not: null } },
        include: { session: true, product: true },
        orderBy: { countedAt: "desc" },
        take: 12,
      },
    },
  });
  if (!loc) notFound();
  const stats = locationStats(loc, loc.products.filter((p) => p.isActive));

  return (
    <>
      <PageHeader
        title={loc.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={LOCATION_TYPE_VARIANT[loc.type]}>{t.enums.locationType[loc.type]}</Badge>
            {loc.isActive ? <Badge variant="success">{t.common.enabled}</Badge> : <Badge variant="secondary">{t.common.disabled}</Badge>}
            <span>
              {fmt(l.zoneTitle, { zone: loc.zone })} · {fmt(l.aisleShort, { n: loc.aisle })} · {fmt(l.levelShort, { n: loc.level })}
            </span>
            {loc.note && <span>· {loc.note}</span>}
          </span>
        }
        backHref="/locations"
        actions={
          <>
            <Button size="sm" asChild>
              <Link href={`/locations/${loc.id}/edit`}>
                <Pencil /> {t.common.edit}
              </Link>
            </Button>
            <ConfirmDelete
              title={fmt(t.common.deleteNamed, { name: loc.code })}
              description={fmt(l.deleteDesc, { n: loc.products.length })}
              action={deleteLocation.bind(null, loc.id)}
            />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={l.colProducts} value={stats.productCount} icon={Package} />
        <StatCard label={l.colStock} value={formatNumber(stats.stock)} icon={Boxes} tone="info" />
        <StatCard label={l.colCapacity} value={loc.capacity ?? "—"} icon={MapPin} tone="success" hint={`${l.sortOrder}: ${loc.sortOrder}`} />
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">{l.utilization}</p>
              <p className={`mt-2 text-2xl font-semibold tracking-tight ${stats.band === "over" ? "text-destructive" : ""}`}>
                {stats.usage !== null ? formatPercent(stats.usage, 0) : "—"}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-[oklch(0.5_0.12_70)]">
              <Gauge className="size-5" />
            </div>
          </div>
          {stats.usage !== null && (
            <Progress value={Math.min(100, stats.usage * 100)} className="mt-3" barClassName={USAGE_BAR_CLASS[stats.band]} />
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{fmt(l.productsTitle, { n: loc.products.length })}</CardTitle>
          </CardHeader>
          {loc.products.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">{l.noProducts}</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.product}</TableHead>
                  <TableHead>{t.common.category}</TableHead>
                  <TableHead className="text-right">{t.products.storeStock}</TableHead>
                  <TableHead className="text-right">{t.products.safetyStock}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loc.products.map((p) => {
                  const name = localName(locale, p);
                  const low = p.inventory && p.inventory.storeStock < p.inventory.safetyStock;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                          <ProductThumb name={name} imageUrl={p.imageUrl} colorKey={p.category.name} className="size-9" />
                          <div className="min-w-0">
                            <div className="truncate font-medium hover:underline">{name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{localName(locale, p.category)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${low ? "font-medium text-destructive" : ""}`}>{p.inventory?.storeStock ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.inventory?.safetyStock ?? 0}</TableCell>
                      <TableCell>
                        {p.isActive ? <Badge variant="success">{t.common.active}</Badge> : <Badge variant="secondary">{t.common.inactive}</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{l.recentCounts}</CardTitle>
            <CardDescription>{l.recentCountsDesc}</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.common.date}</TableHead>
                <TableHead>{t.common.product}</TableHead>
                <TableHead className="text-right">{t.count.colActualShort}</TableHead>
                <TableHead className="text-right">{t.count.variance}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loc.countItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {l.noCounts}
                  </TableCell>
                </TableRow>
              )}
              {loc.countItems.map((ci) => (
                <TableRow key={ci.id}>
                  <TableCell>
                    <Link href={`/inventory-count/${ci.sessionId}`} className="text-xs text-primary hover:underline">
                      {formatDate(ci.session.countDate, locale)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-sm">{localName(locale, ci.product)}</TableCell>
                  <TableCell className="text-right tabular-nums">{ci.actualQty}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${ci.variance ? "text-destructive" : "text-muted-foreground"}`}>
                    {ci.variance}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
