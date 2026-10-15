import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "../product-form";
import { getFormOptions } from "../form-options";

export const generateMetadata = () => pageTitle((t) => t.products.newTitle);
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { t } = await getI18n();
  const { categories, suppliers, locations } = await getFormOptions();
  return (
    <>
      <PageHeader title={t.products.newTitle} description={t.products.newDesc} backHref="/products" />
      <ProductForm
        categories={categories}
        suppliers={suppliers}
        locations={locations}
        initial={{
          sku: "",
          name: "",
          nameEn: null,
          nameJa: null,
          categoryId: "",
          locationId: null,
          supplierId: null,
          imageUrl: null,
          ingredients: null,
          price: "",
          unit: null,
          origin: null,
          recipe: null,
          cookingMethod: null,
          isActive: true,
          posStock: 0,
          storeStock: 0,
          warehouseStock: 0,
          safetyStock: 10,
        }}
      />
    </>
  );
}

