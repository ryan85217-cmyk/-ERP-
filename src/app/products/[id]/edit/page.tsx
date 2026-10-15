import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "../../product-form";
import { getFormOptions } from "../../form-options";

export const generateMetadata = () => pageTitle((t) => t.common.edit);
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getI18n();
  const [product, options] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { inventory: true } }),
    getFormOptions(),
  ]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={fmt(t.products.editTitle, { name: product.name })}
        description={`SKU ${product.sku}`}
        backHref={`/products/${product.id}`}
      />
      <ProductForm
        {...options}
        initial={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          nameEn: product.nameEn,
          nameJa: product.nameJa,
          categoryId: product.categoryId,
          locationId: product.locationId,
          supplierId: product.supplierId,
          imageUrl: product.imageUrl,
          ingredients: product.ingredients,
          price: product.price,
          unit: product.unit,
          origin: product.origin,
          recipe: product.recipe,
          cookingMethod: product.cookingMethod,
          isActive: product.isActive,
          posStock: product.inventory?.posStock ?? 0,
          storeStock: product.inventory?.storeStock ?? 0,
          warehouseStock: product.inventory?.warehouseStock ?? 0,
          safetyStock: product.inventory?.safetyStock ?? 0,
        }}
      />
    </>
  );
}
