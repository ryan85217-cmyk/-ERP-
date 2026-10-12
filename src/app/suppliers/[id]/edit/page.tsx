import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupplierForm } from "../../supplier-form";

export const generateMetadata = () => pageTitle((t) => t.common.edit);
export const dynamic = "force-dynamic";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { products: { orderBy: { sku: "asc" }, include: { category: true } } },
  });
  if (!supplier) notFound();

  return (
    <>
      <PageHeader title={fmt(t.suppliers.editTitle, { name: supplier.name })} backHref="/suppliers" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <SupplierForm
          initial={{
            id: supplier.id,
            name: supplier.name,
            contactName: supplier.contactName,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            note: supplier.note,
          }}
        />
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{fmt(t.suppliers.productsTitle, { n: supplier.products.length })}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {supplier.products.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t.suppliers.noProducts}</p>}
            {supplier.products.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-primary">
                <span className="truncate">{localName(locale, p)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{localName(locale, p.category)}</Badge>
                  <span className="tabular-nums text-muted-foreground">{formatCurrency(p.price)}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
