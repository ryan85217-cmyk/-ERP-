import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierForm } from "../supplier-form";

export const generateMetadata = () => pageTitle((t) => t.suppliers.newTitle);

export default async function NewSupplierPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.suppliers.newTitle} backHref="/suppliers" />
      <SupplierForm initial={{ name: "", contactName: null, phone: null, email: null, address: null, note: null }} />
    </>
  );
}
