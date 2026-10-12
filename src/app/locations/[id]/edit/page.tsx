import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { LocationForm } from "../../location-form";

export const generateMetadata = () => pageTitle((t) => t.common.edit);
export const dynamic = "force-dynamic";

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getI18n();
  const loc = await prisma.storageLocation.findUnique({ where: { id } });
  if (!loc) notFound();
  return (
    <>
      <PageHeader title={fmt(t.locations.editTitle, { code: loc.code })} description={t.locations.newDesc} backHref={`/locations/${loc.id}`} />
      <LocationForm
        initial={{
          id: loc.id,
          zone: loc.zone,
          aisle: loc.aisle,
          level: loc.level,
          type: loc.type,
          capacity: loc.capacity,
          sortOrder: loc.sortOrder,
          note: loc.note,
          isActive: loc.isActive,
        }}
      />
    </>
  );
}
