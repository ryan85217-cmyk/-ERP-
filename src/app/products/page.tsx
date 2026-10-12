import Link from "next/link";
import { Eye, MapPin, Pencil, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteProduct } from "@/lib/actions/products";
import { first, formatCurrency, formatNumber } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoSubmitSelect } from "@/components/shared/auto-submit-select";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

export const generateMetadata = () => pageTitle((t) => t.nav.productList);
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const category = first(sp.category) ?? "";
  const supplier = first(sp.supplier) ?? "";
  const status = first(sp.status) ?? "";
  const zone = first(sp.zone) ?? "";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const and: Prisma.ProductWhereInput[] = [];
  if (q)
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { nameEn: { contains: q, mode: "insensitive" } },
        { nameJa: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    });
  if (category) and.push({ categoryId: category });
  if (supplier) and.push({ supplierId: supplier });
  if (status === "active") and.push({ isActive: true });
  if (status === "inactive") and.push({ isActive: false });
  if (zone) and.push({ location: { zone } });
  const where: Prisma.ProductWhereInput = { AND: and };

  const [products, total, categories, suppliers, activeCount, zones] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, supplier: true, inventory: true, location: true },
      orderBy: [{ sku: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.storageLocation.findMany({ distinct: ["zone"], select: { zone: true }, orderBy: { zone: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title={t.nav.productList}
        description={fmt(t.products.listDesc, { total: formatNumber(total), active: formatNumber(activeCount) })}
        actions={
          <Button asChild>
            <Link href="/products/new">
              <Plus /> {t.products.add}
            </Link>
          </Button>
        }
      />

      <Card>
        <form className="flex flex-col gap-3 border-b p-4 md:flex-row md:flex-wrap md:items-center" method="get">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder={t.products.searchPlaceholder} className="pl-9" />
          </div>
          <AutoSubmitSelect name="category" defaultValue={category} className="md:w-40">
            <option value="">{t.common.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {localName(locale, c)}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="supplier" defaultValue={supplier} className="md:w-48">
            <option value="">{t.common.allSuppliers}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="zone" defaultValue={zone} className="md:w-36">
            <option value="">{t.products.allLocations}</option>
            {zones.map((z) => (
              <option key={z.zone} value={z.zone}>
                {fmt(t.products.zoneOption, { zone: z.zone })}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="status" defaultValue={status} className="md:w-36">
            <option value="">{t.common.allStatus}</option>
            <option value="active">{t.common.active}</option>
            <option value="inactive">{t.common.inactive}</option>
          </AutoSubmitSelect>
          <Button type="submit" variant="secondary">
            {t.common.search}
          </Button>
        </form>

        {products.length === 0 ? (
          <EmptyState title={t.products.emptyTitle} description={t.products.emptyDesc} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.products.colProduct}</TableHead>
                <TableHead>{t.common.category}</TableHead>
                <TableHead className="text-right">{t.products.colPrice}</TableHead>
                <TableHead>{t.products.colLocation}</TableHead>
                <TableHead className="hidden xl:table-cell">{t.common.supplier}</TableHead>
                <TableHead className="hidden lg:table-cell">{t.products.colOrigin}</TableHead>
                <TableHead className="text-right">{t.products.colStoreStock}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const low = p.inventory && p.inventory.storeStock < p.inventory.safetyStock;
                const name = localName(locale, p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                        <ProductThumb name={name} imageUrl={p.imageUrl} colorKey={p.category.name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium hover:underline">{name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{localName(locale, p.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.price)}</TableCell>
                    <TableCell>
                      {p.location ? (
                        <Link
                          href={`/locations/${p.location.id}`}
                          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                        >
                          <MapPin className="size-3" />
                          {p.location.code}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-44 truncate text-muted-foreground xl:table-cell">{p.supplier?.name ?? "—"}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{p.origin ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={low ? "font-medium text-destructive" : ""}>{formatNumber(p.inventory?.storeStock ?? 0)}</span>
                    </TableCell>
                    <TableCell>
                      {p.isActive ? <Badge variant="success">{t.common.active}</Badge> : <Badge variant="secondary">{t.common.inactive}</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" asChild>
                          <Link href={`/products/${p.id}`} aria-label={t.common.view}>
                            <Eye />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" asChild>
                          <Link href={`/products/${p.id}/edit`} aria-label={t.common.edit}>
                            <Pencil />
                          </Link>
                        </Button>
                        <ConfirmDelete
                          iconOnly
                          title={fmt(t.common.deleteNamed, { name })}
                          description={t.products.deleteDesc}
                          action={deleteProduct.bind(null, p.id, undefined)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          basePath="/products"
          params={{ q, category, supplier, status, zone }}
        />
      </Card>
    </>
  );
}
