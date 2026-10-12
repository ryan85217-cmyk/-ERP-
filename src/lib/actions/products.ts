"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";
import { emptyToNull, zodFieldErrors, type FormState } from "./types";

function productSchema(t: Messages) {
  const p = t.products;
  const stock = z.coerce.number().int().min(0, t.common.nonNegative);
  return z.object({
    sku: z.string().trim().min(1, p.skuRequired).max(40, p.skuTooLong),
    name: z.string().trim().min(1, p.nameRequired).max(120),
    nameEn: z.string().max(160).nullable(),
    nameJa: z.string().max(160).nullable(),
    categoryId: z.string().min(1, p.categoryRequired),
    supplierId: z.string().nullable(),
    locationId: z.string().nullable(),
    imageUrl: z
      .string()
      .nullable()
      .refine((v) => v === null || /^https?:\/\//.test(v) || v.startsWith("/"), p.imageUrlInvalid),
    ingredients: z.string().nullable(),
    price: z.coerce.number({ invalid_type_error: p.priceRequired, required_error: p.priceRequired }).int(p.priceInteger).min(0, p.priceNonNegative),
    origin: z.string().nullable(),
    recipe: z.string().nullable(),
    cookingMethod: z.string().nullable(),
    isActive: z.boolean(),
    posStock: stock,
    storeStock: stock,
    warehouseStock: stock,
    safetyStock: stock,
  });
}

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const id = emptyToNull(formData.get("id"));
  const parsed = productSchema(t).safeParse({
    sku: formData.get("sku") ?? "",
    name: formData.get("name") ?? "",
    nameEn: emptyToNull(formData.get("nameEn")),
    nameJa: emptyToNull(formData.get("nameJa")),
    categoryId: formData.get("categoryId") ?? "",
    supplierId: emptyToNull(formData.get("supplierId")),
    locationId: emptyToNull(formData.get("locationId")),
    imageUrl: emptyToNull(formData.get("imageUrl")),
    ingredients: emptyToNull(formData.get("ingredients")),
    price: formData.get("price") || undefined,
    origin: emptyToNull(formData.get("origin")),
    recipe: emptyToNull(formData.get("recipe")),
    cookingMethod: emptyToNull(formData.get("cookingMethod")),
    isActive: formData.get("isActive") === "on",
    posStock: formData.get("posStock") || 0,
    storeStock: formData.get("storeStock") || 0,
    warehouseStock: formData.get("warehouseStock") || 0,
    safetyStock: formData.get("safetyStock") || 0,
  });
  if (!parsed.success) {
    return { error: t.common.fixFields, fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { posStock, storeStock, warehouseStock, safetyStock, ...product } = parsed.data;
  const stock = { posStock, storeStock, warehouseStock, safetyStock };

  let productId: string;
  try {
    if (id) {
      const updated = await prisma.product.update({
        where: { id },
        data: {
          ...product,
          inventory: { upsert: { create: stock, update: stock } },
        },
      });
      productId = updated.id;
    } else {
      const created = await prisma.product.create({
        data: { ...product, inventory: { create: stock } },
      });
      productId = created.id;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: t.products.skuExists, fieldErrors: { sku: t.products.skuExistsField } };
    }
    console.error(e);
    return { error: t.common.saveFailed };
  }

  revalidatePath("/products");
  revalidatePath("/inventory", "layout");
  revalidatePath("/locations", "layout");
  redirect(`/products/${productId}`);
}

export async function deleteProduct(id: string, redirectTo?: string) {
  try {
    await prisma.product.delete({ where: { id } });
  } catch (e) {
    console.error(e);
    const { t } = await getI18n();
    return { error: t.products.deleteFailed };
  }
  revalidatePath("/products");
  revalidatePath("/inventory", "layout");
  revalidatePath("/locations", "layout");
  if (redirectTo) redirect(redirectTo);
}

export async function toggleProductActive(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, select: { isActive: true } });
  if (!p) return;
  await prisma.product.update({ where: { id }, data: { isActive: !p.isActive } });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}
