import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/utils";
import { localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { NewCountForm } from "./new-count-form";

export const generateMetadata = () => pageTitle((t) => t.nav.countNew);
export const dynamic = "force-dynamic";

export default async function NewCountPage() {
  const { t, locale } = await getI18n();
  const [categories, locations, unassigned] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    }),
    prisma.storageLocation.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    }),
    prisma.product.count({ where: { isActive: true, locationId: null } }),
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
