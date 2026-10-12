import Link from "next/link";
import { Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { COUNT_STATUS_VARIANT } from "@/lib/constants";
import { toDateInputValue } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { NewCountForm } from "./new-count-form";

export const generateMetadata = () => pageTitle((t) => t.nav.countNew);
export const dynamic = "force-dynamic";

export default async function NewCountPage() {
  const { t, locale } = await getI18n();
  const [categories, locations, unassigned, active] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    }),
    prisma.storageLocation.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    }),
    prisma.product.count({ where: { isActive: true, locationId: null } }),
    prisma.inventoryCountSession.findMany({
      where: { status: { in: ["DRAFT", "IN_PROGRESS", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, status: true, zones: true },
    }),
  ]);

  // aggregate locations into zones, keeping walking order
  const zoneMap = new Map<string, { zone: string; locationCount: number; productCount: number; types: Set<string> }>();
  for (const l of locations) {
    const z = zoneMap.get(l.zone) ?? { zone: l.zone, locationCount: 0, productCount: 0, types: new Set<string>() };
    z.locationCount += 1;
    z.productCount += l._count.products;
    z.types.add(t.enums.locationType[l.type]);
    zoneMap.set(l.zone, z);
  }

  return (
    <>
      <PageHeader title={t.nav.countNew} description={t.count.newDesc} backHref="/inventory-count" />
      {active.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <div className="min-w-0">
            <p>{fmt(t.count.activeNotice, { n: active.length })}</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
              {active.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <Link href={`/inventory-count/${s.id}`} className="font-mono text-xs font-medium hover:underline">
                    {s.code}
                  </Link>
                  <Badge variant={COUNT_STATUS_VARIANT[s.status]}>{t.enums.countStatus[s.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {s.zones.length ? fmt(t.count.scopeZones, { zones: s.zones.join(", ") }) : t.count.scopeAll}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <NewCountForm
        defaultDate={toDateInputValue(new Date())}
        defaultOperator={t.common.userName}
        unassignedCount={unassigned}
        categories={categories.map((c) => ({ id: c.id, name: localName(locale, c), productCount: c._count.products }))}
        zones={[...zoneMap.values()]
          .filter((z) => z.productCount > 0)
          .map((z) => ({ zone: z.zone, locationCount: z.locationCount, productCount: z.productCount, types: [...z.types].join(" / ") }))}
      />
    </>
  );
}
