import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Boxes, RefreshCw, Search, Store, Truck, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { alignPosToStore, replenishFromWarehouse, syncPosInventory } from "@/lib/actions/inventory";
import { FLAG_VARIANT, stockFlags, type StockFlag } from "@/lib/inventory";
import { cn, first, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoSubmitSelect } from "@/components/shared/auto-submit-select";
import { ProductThumb } from "@/components/shared/product-thumb";
import { EmptyState } from "@/components/shared/empty-state";

type View = "store" | "pos" | "warehouse" | "alerts";

const VIEWS: Record<
  View,
  { title: (t: Messages) => string; description: (t: Messages) => string; sortKey: "storeStock" | "posStock" | "warehouseStock" }
> = {
  store: { title: (t) => t.nav.invStore, description: (t) => t.inventory.storeDesc, sortKey: "storeStock" },
  pos: { title: (t) => t.nav.invPos, description: (t) => t.inventory.posDesc, sortKey: "posStock" },
  warehouse: { title: (t) => t.nav.invWarehouse, description: (t) => t.inventory.warehouseDesc, sortKey: "warehouseStock" },
  alerts: { title: (t) => t.nav.invAlerts, description: (t) => t.inventory.alertsDesc, sortKey: "storeStock" },
};

export async function generateMetadata({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const { t } = await getI18n();
  return { title: VIEWS[view as View]?.title(t) ?? t.nav.inventory };
}

export const dynamic = "force-dynamic";

export default async function InventoryViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view: viewParam } = await params;
  if (!Object.prototype.hasOwnProperty.call(VIEWS, viewParam)) notFound();
  const view = viewParam as View;
  const cfg = VIEWS[view];
  const { t, locale } = await getI18n();
  const iv = t.inventory;
  const sp = await searchParams;
  const q = first(sp.q)?.trim().toLowerCase() ?? "";
  const category = first(sp.category) ?? "";
  const zone = first(sp.zone) ?? "";
  const flagFilter = (first(sp.flag) ?? (view === "alerts" ? "any" : "")) as StockFlag | "any" | "ok" | "";

  const [rows, categories] = await Promise.all([
    prisma.inventory.findMany({
      where: { product: { isActive: true } },
      include: { product: { include: { category: true, location: true } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const zones = Array.from(new Set(rows.map((r) => r.product.location?.zone).filter((z): z is string => !!z))).sort();

  const enriched = rows.map((r) => ({ ...r, flags: stockFlags(r) }));
  const totals = {
    store: enriched.reduce((a, r) => a + r.storeStock, 0),
    pos: enriched.reduce((a, r) => a + r.posStock, 0),
    warehouse: enriched.reduce((a, r) => a + r.warehouseStock, 0),
    storeValue: enriched.reduce((a, r) => a + r.storeStock * r.product.price, 0),
    warehouseValue: enriched.reduce((a, r) => a + r.warehouseStock * r.product.price, 0),
    low: enriched.filter((r) => r.flags.includes("low")).length,
    mismatch: enriched.filter((r) => r.flags.includes("mismatch")).length,
    high: enriched.filter((r) => r.flags.includes("high")).length,
  };
  const lastSync = rows.reduce<Date | null>((a, r) => (!a || r.lastSyncedAt > a ? r.lastSyncedAt : a), null);

  const filtered = enriched
    .filter(
      (r) =>
        !q ||
        [r.product.name, r.product.nameEn, r.product.nameJa, r.product.sku, r.product.location?.code]
          .some((v) => v?.toLowerCase().includes(q)),
    )
    .filter((r) => !category || r.product.categoryId === category)
    .filter((r) => !zone || r.product.location?.zone === zone)
    .filter((r) => {
      if (!flagFilter) return true;
      if (flagFilter === "any") return r.flags.length > 0;
      if (flagFilter === "ok") return r.flags.length === 0;
      return r.flags.includes(flagFilter);
    })
    .sort((a, b) => {
      if (view === "pos") return Math.abs(b.posStock - b.storeStock) - Math.abs(a.posStock - a.storeStock) || b.posStock - a.posStock;
      if (view === "alerts") return b.flags.length - a.flags.length || a.storeStock / Math.max(1, a.safetyStock) - b.storeStock / Math.max(1, b.safetyStock);
      return b[cfg.sortKey] - a[cfg.sortKey];
    });

  return (
    <>
      <PageHeader
        title={cfg.title(t)}
        description={fmt(iv.lastSync, { desc: cfg.description(t), time: formatDateTime(lastSync, locale) })}
        actions={
          <form action={syncPosInventory}>
            <Button variant="outline" type="submit">
              <RefreshCw /> {iv.syncPos}
            </Button>
          </form>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {view === "warehouse" ? (
          <>
            <StatCard label={iv.warehouseTotal} value={formatNumber(totals.warehouse)} icon={Warehouse} tone="info" />
            <StatCard label={iv.warehouseValue} value={formatCurrency(totals.warehouseValue)} icon={Truck} />
            <StatCard
              label={iv.replenishable}
              value={enriched.filter((r) => r.flags.includes("low") && r.warehouseStock > 0).length}
              icon={Boxes}
              tone="success"
              hint={iv.replenishableHint}
            />
            <StatCard label={iv.storeLow} value={totals.low} icon={AlertTriangle} tone="destructive" />
          </>
        ) : (
          <>
            <StatCard
              label={view === "pos" ? iv.posTotal : iv.storeTotal}
              value={formatNumber(view === "pos" ? totals.pos : totals.store)}
              icon={view === "pos" ? Boxes : Store}
              hint={fmt(iv.activeProducts, { n: rows.length })}
            />
            <StatCard label={t.enums.stockFlag.low} value={totals.low} icon={AlertTriangle} tone="destructive" hint={iv.belowSafety} />
            <StatCard
              label={iv.mismatchLabel}
              value={totals.mismatch}
              icon={ArrowLeftRight}
              tone="warning"
              hint={fmt(iv.mismatchHint, { n: formatNumber(totals.pos - totals.store) })}
            />
            <StatCard label={t.enums.stockFlag.high} value={totals.high} icon={Warehouse} tone="info" hint={iv.highHint} />
          </>
        )}
      </div>

      <Card>
        {view === "alerts" && (
          <CardHeader className="border-b">
            <CardTitle>{iv.alertListTitle}</CardTitle>
            <CardDescription>{iv.alertListDesc}</CardDescription>
          </CardHeader>
        )}
        <form method="get" className="flex flex-col gap-3 border-b p-4 md:flex-row md:flex-wrap md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder={t.products.searchPlaceholder} className="pl-9" />
          </div>
          <AutoSubmitSelect name="category" defaultValue={category} className="md:w-40">
            <option value="">{t.common.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {localName(locale, c)}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="zone" defaultValue={zone} className="md:w-36">
            <option value="">{iv.allZones}</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {fmt(iv.zoneOption, { zone: z })}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="flag" defaultValue={flagFilter} className="md:w-44">
            <option value="">{t.common.allStatus}</option>
            <option value="any">{iv.allAlerts}</option>
            <option value="low">{t.enums.stockFlag.low}</option>
            <option value="mismatch">{t.enums.stockFlag.mismatch}</option>
            <option value="high">{t.enums.stockFlag.high}</option>
            <option value="ok">{t.enums.stockFlag.ok}</option>
          </AutoSubmitSelect>
          <Button type="submit" variant="secondary">
            {t.common.search}
          </Button>
        </form>

        {filtered.length === 0 ? (
          <EmptyState title={t.common.noMatch} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.common.product}</TableHead>
                <TableHead>{iv.colLocation}</TableHead>
                <TableHead className={cn("text-right", view === "pos" && "text-foreground")}>{iv.colPos}</TableHead>
                <TableHead className={cn("text-right", view === "store" && "text-foreground")}>{iv.colStore}</TableHead>
                <TableHead className="text-right">{iv.colDiff}</TableHead>
                <TableHead className={cn("text-right", view === "warehouse" && "text-foreground")}>{iv.colWarehouse}</TableHead>
                <TableHead className="text-right">{iv.colSafety}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="hidden 2xl:table-cell">{iv.colLastSync}</TableHead>
                {view !== "store" && <TableHead className="text-right">{t.common.actions}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const diff = r.posStock - r.storeStock;
                const canReplenish = r.flags.includes("low") && r.warehouseStock > 0;
                const name = localName(locale, r.product);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/products/${r.productId}`} className="flex items-center gap-3">
                        <ProductThumb name={name} imageUrl={r.product.imageUrl} colorKey={r.product.category.name} className="size-9" />
                        <div className="min-w-0">
                          <div className="truncate font-medium hover:underline">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{r.product.sku}</span> · {localName(locale, r.product.category)}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.product.location ? (
                        <Link href={`/locations/${r.product.location.id}`} className="font-mono text-xs text-primary hover:underline">
                          {r.product.location.code}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", view === "pos" && "font-semibold")}>{r.posStock}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", view === "store" && "font-semibold", r.flags.includes("low") && "text-destructive")}>
                      {r.storeStock}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", diff !== 0 ? "font-medium text-[oklch(0.55_0.13_60)]" : "text-muted-foreground")}>
                      {diff > 0 ? `+${diff}` : diff}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", view === "warehouse" && "font-semibold")}>{r.warehouseStock}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.safetyStock}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.flags.length === 0 ? (
                          <Badge variant="success">{t.enums.stockFlag.ok}</Badge>
                        ) : (
                          r.flags.map((f) => (
                            <Badge key={f} variant={FLAG_VARIANT[f]}>
                              {t.enums.stockFlag[f]}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground 2xl:table-cell">{formatDateTime(r.lastSyncedAt, locale)}</TableCell>
                    {view !== "store" && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {(view === "warehouse" || view === "alerts") && canReplenish && (
                            <form action={replenishFromWarehouse.bind(null, r.productId)}>
                              <Button size="sm" variant="outline" type="submit">
                                <Truck /> {iv.replenish}
                              </Button>
                            </form>
                          )}
                          {(view === "pos" || view === "alerts") && diff !== 0 && (
                            <form action={alignPosToStore.bind(null, r.productId)}>
                              <Button size="sm" variant="ghost" type="submit">
                                <ArrowLeftRight /> {iv.alignPos}
                              </Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
