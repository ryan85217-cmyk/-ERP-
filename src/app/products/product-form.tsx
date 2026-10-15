"use client";

import { startTransition, useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { saveProduct } from "@/lib/actions/products";
import { initialFormState } from "@/lib/actions/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { ProductThumb } from "@/components/shared/product-thumb";
import { useI18n } from "@/i18n/client";

export interface ProductFormValues {
  id?: string;
  sku: string;
  name: string;
  nameEn: string | null;
  nameJa: string | null;
  categoryId: string;
  locationId: string | null;
  supplierId: string | null;
  imageUrl: string | null;
  ingredients: string | null;
  price: number | "";
  unit: string | null;
  origin: string | null;
  recipe: string | null;
  cookingMethod: string | null;
  isActive: boolean;
  posStock: number;
  storeStock: number;
  warehouseStock: number;
  safetyStock: number;
}

export function ProductForm({
  initial,
  categories,
  suppliers,
  locations,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  locations: { id: string; code: string; label: string }[];
}) {
  const { t } = useI18n();
  const p = t.products;
  const [state, formAction, pending] = useActionState(saveProduct, initialFormState);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [name, setName] = useState(initial.name);
  const fe = state.fieldErrors ?? {};

  return (
    <form
      className="grid gap-6 lg:grid-cols-3"
      onSubmit={(e) => {
        // submit manually so React does not reset the form on validation errors
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{p.basicTitle}</CardTitle>
            <CardDescription>{p.basicDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.common.sku} htmlFor="sku" required error={fe.sku}>
              <Input id="sku" name="sku" defaultValue={initial.sku} placeholder={p.skuPlaceholder} />
            </FormField>
            <FormField label={p.name} htmlFor="name" required error={fe.name}>
              <Input id="name" name="name" defaultValue={initial.name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label={p.nameEn} htmlFor="nameEn" error={fe.nameEn} hint={p.nameI18nHint}>
              <Input id="nameEn" name="nameEn" defaultValue={initial.nameEn ?? ""} />
            </FormField>
            <FormField label={p.nameJa} htmlFor="nameJa" error={fe.nameJa}>
              <Input id="nameJa" name="nameJa" defaultValue={initial.nameJa ?? ""} />
            </FormField>
            <FormField label={p.category} htmlFor="categoryId" required error={fe.categoryId}>
              <Select id="categoryId" name="categoryId" defaultValue={initial.categoryId}>
                <option value="">{p.selectCategory}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={p.priceLabel} htmlFor="price" required error={fe.price}>
              <Input id="price" name="price" type="number" min={0} step={1} defaultValue={initial.price} />
            </FormField>
            <FormField label={t.common.supplier} htmlFor="supplierId" error={fe.supplierId}>
              <Select id="supplierId" name="supplierId" defaultValue={initial.supplierId ?? ""}>
                <option value="">{t.common.unspecified}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={p.unit} htmlFor="unit" error={fe.unit}>
              <Input id="unit" name="unit" maxLength={10} defaultValue={initial.unit ?? ""} placeholder={p.unitPlaceholder} />
            </FormField>
            <FormField label={p.origin} htmlFor="origin" error={fe.origin}>
              <Input id="origin" name="origin" defaultValue={initial.origin ?? ""} placeholder={p.originPlaceholder} />
            </FormField>
            <FormField label={p.ingredients} htmlFor="ingredients" className="sm:col-span-2" error={fe.ingredients}>
              <Textarea id="ingredients" name="ingredients" rows={2} defaultValue={initial.ingredients ?? ""} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.cookingTitle}</CardTitle>
            <CardDescription>{p.cookingDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField label={p.cookingMethod} htmlFor="cookingMethod">
              <Input id="cookingMethod" name="cookingMethod" defaultValue={initial.cookingMethod ?? ""} placeholder={p.cookingPlaceholder} />
            </FormField>
            <FormField label={p.recipe} htmlFor="recipe">
              <Textarea id="recipe" name="recipe" rows={4} defaultValue={initial.recipe ?? ""} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.stockTitle}</CardTitle>
            <CardDescription>{p.stockDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <FormField label={p.location} htmlFor="locationId" error={fe.locationId} className="sm:col-span-4">
              <Select id="locationId" name="locationId" defaultValue={initial.locationId ?? ""}>
                <option value="">{p.noLocation}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={p.posStock} htmlFor="posStock" error={fe.posStock}>
              <Input id="posStock" name="posStock" type="number" min={0} defaultValue={initial.posStock} />
            </FormField>
            <FormField label={p.storeStock} htmlFor="storeStock" error={fe.storeStock}>
              <Input id="storeStock" name="storeStock" type="number" min={0} defaultValue={initial.storeStock} />
            </FormField>
            <FormField label={p.warehouseStock} htmlFor="warehouseStock" error={fe.warehouseStock}>
              <Input id="warehouseStock" name="warehouseStock" type="number" min={0} defaultValue={initial.warehouseStock} />
            </FormField>
            <FormField label={p.safetyStock} htmlFor="safetyStock" error={fe.safetyStock}>
              <Input id="safetyStock" name="safetyStock" type="number" min={0} defaultValue={initial.safetyStock} />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{p.imageTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
              <ProductThumb name={name || "?"} imageUrl={imageUrl || null} className="size-full rounded-none border-0 text-5xl" />
            </div>
            <FormField label={p.imageUrl} htmlFor="imageUrl" error={fe.imageUrl} hint={p.imageHint}>
              <Input id="imageUrl" name="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.statusTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="size-4 accent-[var(--primary)]" />
              <span className="text-sm">{p.activeLabel}</span>
            </label>
          </CardContent>
        </Card>

        {state.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {initial.id ? t.common.saveChanges : p.create}
          </Button>
          <Button variant="outline" asChild>
            <Link href={initial.id ? `/products/${initial.id}` : "/products"}>{t.common.cancel}</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
