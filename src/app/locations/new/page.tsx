import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { LocationForm } from "../location-form";

export const generateMetadata = () => pageTitle((t) => t.locations.newTitle);

export default async function NewLocationPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.locations.newTitle} description={t.locations.newDesc} backHref="/locations" />
      <LocationForm initial={{ zone: "", aisle: 1, level: 1, type: "SHELF", capacity: 100, sortOrder: null, note: null, isActive: true }} />
    </>
  );
}
