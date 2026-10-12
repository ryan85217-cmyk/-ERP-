import { prisma } from "@/lib/prisma";
import { localName } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

/** Select options shared by the new / edit product forms, localized for the current request. */
export async function getFormOptions() {
  const { t, locale } = await getI18n();
  const [categories, suppliers, locations] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.storageLocation.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: localName(locale, c) })),
    suppliers,
    locations: locations.map((l) => ({ id: l.id, code: l.code, label: t.enums.locationType[l.type] })),
  };
}
