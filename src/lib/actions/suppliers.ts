"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { emptyToNull, zodFieldErrors, type FormState } from "./types";

export async function saveSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const supplierSchema = z.object({
    name: z.string().trim().min(1, t.suppliers.nameRequired).max(120),
    contactName: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().email(t.common.invalidEmail).nullable(),
    address: z.string().nullable(),
    note: z.string().nullable(),
  });
  const id = emptyToNull(formData.get("id"));
  const parsed = supplierSchema.safeParse({
    name: formData.get("name") ?? "",
    contactName: emptyToNull(formData.get("contactName")),
    phone: emptyToNull(formData.get("phone")),
    email: emptyToNull(formData.get("email")),
    address: emptyToNull(formData.get("address")),
    note: emptyToNull(formData.get("note")),
  });
  if (!parsed.success) return { error: t.common.fixFields, fieldErrors: zodFieldErrors(parsed.error) };

  try {
    if (id) await prisma.supplier.update({ where: { id }, data: parsed.data });
    else await prisma.supplier.create({ data: parsed.data });
  } catch (e) {
    console.error(e);
    return { error: t.common.saveFailed };
  }
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function deleteSupplier(id: string) {
  try {
    // products keep existing; supplierId is set to NULL by the FK rule
    await prisma.supplier.delete({ where: { id } });
  } catch (e) {
    console.error(e);
    return { error: (await getI18n()).t.common.deleteFailed };
  }
  revalidatePath("/suppliers");
  revalidatePath("/products");
}
