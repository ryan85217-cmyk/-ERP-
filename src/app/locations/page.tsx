import Link from "next/link";
import { AlertTriangle, Boxes, MapPin, Pencil, Plus, Search, SquareDashed } from "lucide-react";
import type { LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteLocation } from "@/lib/actions/locations";
import { LOCATION_TYPES, LOCATION_TYPE_VARIANT } from "@/lib/constants";
import { USAGE_BAND_CLASS, USAGE_BAR_CLASS, locationStats, type UsageBand } from "@/lib/locations";
import { cn, first, formatNumber, formatPercent } from "@/lib/utils";
import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoSubmitSelect } from "@/components/shared/auto-submit-select";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

export const generateMetadata = () => pageTitle((t) => t.nav.locations);
export const dynamic = "force-dynamic";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  const l = t.locations;
  const sp = await searchParams;
  const q = first(sp.q)?.trim().toUpperCase() ?? "";
  const zone = first(sp.zone) ?? "";
  const typeParam = first(sp.type) ?? "";
  const type = LOCATION_TYPES.find((x) => x === typeParam);

  const [all, unassigned] = await Promise.all([
    prisma.storageLocation.findMany({
      orderBy: { sortOrder: "asc" },
      include: { products: { where: { isActive: true }, select: { inventory: { select: { storeStock: true } } } } },
    }),
    prisma.product.count({ where: { isActive: true, locationId: null } }),
  ]);
  const enriched = all.map((loc) => ({ ...loc, stats: locationStats(loc, loc.products) }));
  const zones = Array.from(new Set(enriched.map((x) => x.zone)));
  const filtered = enriched.filter(
    (x) =>
      (!zone || x.zone === zone) &&
      (!type || x.type === type) &&
      (!q || x.code.includes(q) || (x.note ?? "").toUpperCase().includes(q)),
  );
  const used = enriched.filter((x) => x.stats.productCount > 0).length;
  const over = enriched.filter((x) => x.stats.band === "over").length;

  // floor map: zone → aisle → levels
  const floor = zones.map((z) => {
    const locs = enriched.filter((x) => x.zone === z);
    const aisles = Array.from(new Set(locs.map((x) => x.aisle))).sort((a, b) => a - b);
    const levels = Array.from(new Set(locs.map((x) => x.level))).sort((a, b) => b - a); // top shelf first
    return { zone: z, type: locs[0]?.type as LocationType, aisles, levels, locs };
  });
  const legend: [UsageBand, string][] = [
    ["empty", l.legendEmpty],
    ["low", l.legendLow],
    ["mid", l.legendMid],
    ["high", l.legendHigh],
    ["over", l.legendOver],
    ["inactive", l.legendInactive],
  ];

  return (
    <>
      <PageHeader
        title={t.nav.locations}
        description={fmt(l.listDesc, { total: enriched.length, used })}
        actions={
          <Button asChild>
            <Link href="/locations/new">
              <Plus /> {l.add}
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={l.statTotal} value={enriched.length} icon={MapPin} />
        <StatCard label={l.statUsed} value={used} icon={Boxes} tone="success" />
        <StatCard label={l.statEmpty} value={enriched.length - used} icon={SquareDashed} tone="info" />
        <StatCard label={l.statOver} value={over} icon={AlertTriangle} tone="destructive" hint={l.statOverHint} />
      </div>

      {unassigned > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
          <span>
            <b>{l.unassignedTitle}</b> · {fmt(l.unassignedDesc, { n: unassigned })}
          </span>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{l.floorMap}</CardTitle>
            <CardDescription>{l.floorMapDesc}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {legend.map(([band, label]) => (
              <span key={band} className={cn("rounded border px-1.5 py-0.5", USAGE_BAND_CLASS[band])}>
                {label}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {floor.map((z) => (
            <div key={z.zone} className="rounded-lg border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                <span className="whitespace-nowrap font-semibold">{fmt(l.zoneTitle, { zone: z.zone })}</span>
                {z.type && <Badge variant={LOCATION_TYPE_VARIANT[z.type]}>{t.enums.locationType[z.type]}</Badge>}
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${z.aisles.length}, minmax(0, 1fr))` }}>
                <span />
                {z.aisles.map((a) => (
                  <span key={a} className="text-center text-[10px] text-muted-foreground">
                    {fmt(l.aisleShort, { n: a })}
                  </span>
                ))}
                {z.levels.map((lv) => (
                  <div key={lv} className="contents">
                    <span className="pr-1 text-right text-[10px] leading-8 text-muted-foreground">{fmt(l.levelShort, { n: lv })}</span>
                    {z.aisles.map((a) => {
                      const loc = z.locs.find((x) => x.aisle === a && x.level === lv);
                      if (!loc) return <span key={a} />;
                      return (
                        <Link
                          key={a}
                          href={`/locations/${loc.id}`}
                          title={`${loc.code} · ${loc.stats.stock}${loc.capacity ? ` / ${loc.capacity}` : ""}`}
                          className={cn(
                            "flex h-8 items-center justify-center rounded border text-[11px] font-medium tabular-nums transition-transform hover:scale-105",
                            USAGE_BAND_CLASS[loc.stats.band],
                          )}
                        >
                          {loc.stats.usage !== null && loc.isActive ? formatPercent(loc.stats.usage, 0) : loc.stats.productCount || "·"}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder={l.searchPlaceholder} className="pl-9" />
          </div>
          <AutoSubmitSelect name="zone" defaultValue={zone} className="md:w-36">
            <option value="">{l.allZones}</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {fmt(l.zoneTitle, { zone: z })}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="type" defaultValue={type ?? ""} className="md:w-40">
            <option value="">{l.allTypes}</option>
            {LOCATION_TYPES.map((x) => (
              <option key={x} value={x}>
                {t.enums.locationType[x]}
              </option>
            ))}
          </AutoSubmitSelect>
          <Button type="submit" variant="secondary">
            {t.common.search}
          </Button>
        </form>
        {filtered.length === 0 ? (
          <EmptyState title={l.emptyList} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{l.colCode}</TableHead>
                <TableHead>{l.colType}</TableHead>
                <TableHead className="text-right">{l.colProducts}</TableHead>
                <TableHead className="text-right">{l.colStock}</TableHead>
                <TableHead className="text-right">{l.colCapacity}</TableHead>
                <TableHead className="w-44">{l.colUsage}</TableHead>
                <TableHead className="hidden lg:table-cell">{t.common.note}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell>
                    <Link href={`/locations/${loc.id}`} className="font-mono font-medium text-primary hover:underline">
                      {loc.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={LOCATION_TYPE_VARIANT[loc.type]}>{t.enums.locationType[loc.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{loc.stats.productCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(loc.stats.stock)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{loc.capacity ?? "—"}</TableCell>
                  <TableCell>
                    {loc.stats.usage !== null ? (
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(100, loc.stats.usage * 100)} className="flex-1" barClassName={USAGE_BAR_CLASS[loc.stats.band]} />
                        <span className={cn("w-11 text-right text-xs tabular-nums", loc.stats.band === "over" && "font-semibold text-destructive")}>
                          {formatPercent(loc.stats.usage, 0)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-48 truncate text-xs text-muted-foreground lg:table-cell">{loc.note ?? "—"}</TableCell>
                  <TableCell>
                    {loc.isActive ? <Badge variant="success">{t.common.enabled}</Badge> : <Badge variant="secondary">{t.common.disabled}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" asChild>
                        <Link href={`/locations/${loc.id}/edit`} aria-label={t.common.edit}>
                          <Pencil />
                        </Link>
                      </Button>
                      <ConfirmDelete
                        iconOnly
                        title={fmt(t.common.deleteNamed, { name: loc.code })}
                        description={fmt(l.deleteDesc, { n: loc.stats.productCount })}
                        action={deleteLocation.bind(null, loc.id)}
                      />
                    </div>
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
