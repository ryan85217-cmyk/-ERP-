import Link from "next/link";
import { Mail, MapPin, Pencil, Phone, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteSupplier } from "@/lib/actions/suppliers";
import { first, formatNumber } from "@/lib/utils";
import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

export const generateMetadata = () => pageTitle((t) => t.nav.suppliers);
export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  const s = t.suppliers;
  const q = first((await searchParams).q)?.trim() ?? "";
  const suppliers = await prisma.supplier.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title={t.nav.suppliers}
        description={fmt(s.listDesc, { n: formatNumber(suppliers.length) })}
        actions={
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus /> {s.add}
            </Link>
          </Button>
        }
      />
      <Card>
        <form method="get" className="flex gap-3 border-b p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder={s.searchPlaceholder} className="pl-9" />
          </div>
          <Button type="submit" variant="secondary">
            {t.common.search}
          </Button>
        </form>
        {suppliers.length === 0 ? (
          <EmptyState title={s.empty} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.colName}</TableHead>
                <TableHead>{s.colContact}</TableHead>
                <TableHead className="hidden lg:table-cell">{s.colContactInfo}</TableHead>
                <TableHead className="hidden xl:table-cell">{s.colAddress}</TableHead>
                <TableHead className="text-center">{s.colProducts}</TableHead>
                <TableHead className="hidden md:table-cell">{t.common.note}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((sup) => (
                <TableRow key={sup.id}>
                  <TableCell className="font-medium">{sup.name}</TableCell>
                  <TableCell>{sup.contactName ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {sup.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-3" />
                          {sup.phone}
                        </span>
                      )}
                      {sup.email && (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="size-3" />
                          {sup.email}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-60 text-xs text-muted-foreground xl:table-cell">
                    {sup.address && (
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3 shrink-0" />
                        {sup.address}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/products?supplier=${sup.id}`}>
                      <Badge variant="secondary" className="hover:bg-muted">
                        {fmt(t.common.itemsCount, { n: sup._count.products })}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate text-xs text-muted-foreground md:table-cell">{sup.note ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" asChild>
                        <Link href={`/suppliers/${sup.id}/edit`} aria-label={t.common.edit}>
                          <Pencil />
                        </Link>
                      </Button>
                      <ConfirmDelete
                        iconOnly
                        title={fmt(t.common.deleteNamed, { name: sup.name })}
                        description={fmt(s.deleteDesc, { n: sup._count.products })}
                        action={deleteSupplier.bind(null, sup.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
