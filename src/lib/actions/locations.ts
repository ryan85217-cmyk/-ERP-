"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LOCATION_TYPES } from "@/lib/constants";
import { locationCode } from "@/lib/locations";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { emptyToNull, zodFieldErrors, type FormState } from "./types";

function revalidateLocations() {
  revalidatePath("/locations", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/inventory-count/new");
}

/** Default walking order: keep the zone's hundred-block, then aisle × 10 + level. */
async function defaultSortOrder(zone: string, aisle: number, level: number) {
  const sameZone = await prisma.storageLocation.aggregate({ where: { zone }, _min: { sortOrder: true } });
  const base =
    sameZone._min.sortOrder !== null
      ? Math.floor(sameZone._min.sortOrder / 100) * 100
      : (Math.floor(((await prisma.storageLocation.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -100) / 100) + 1) * 100;
  return base + aisle * 10 + level;
}

export async function saveLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const l = t.locations;
  const slot = z.coerce.number({ invalid_type_error: l.numberInvalid }).int(l.numberInvalid).min(1, l.numberInvalid).max(99, l.numberInvalid);
  const schema = z.object({
    zone: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{1,3}$/, l.zoneInvalid),
    aisle: slot,
    level: slot,
    type: z.enum(LOCATION_TYPES as [string, ...string[]]),
    capacity: z.coerce.number().int(l.capacityInvalid).min(1, l.capacityInvalid).nullable(),
    sortOrder: z.coerce.number().int().min(0, t.common.nonNegative).nullable(),
    note: z.string().max(200).nullable(),
    isActive: z.boolean(),
  });

  const id = emptyToNull(formData.get("id"));
  const parsed = schema.safeParse({
    zone: formData.get("zone") ?? "",
    aisle: formData.get("aisle") || undefined,
    level: formData.get("level") || undefined,
    type: formData.get("type") ?? "SHELF",
    capacity: emptyToNull(formData.get("capacity")),
    sortOrder: emptyToNull(formData.get("sortOrder")),
    note: emptyToNull(formData.get("note")),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: t.common.fixFields, fieldErrors: zodFieldErrors(parsed.error) };

  const d = parsed.data;
  const code = locationCode(d.zone, d.aisle, d.level);
  const data = {
    code,
    zone: d.zone,
    aisle: d.aisle,
    level: d.level,
    type: d.type as (typeof LOCATION_TYPES)[number],
    capacity: d.capacity,
    sortOrder: d.sortOrder ?? (await defaultSortOrder(d.zone, d.aisle, d.level)),
    note: d.note,
    isActive: d.isActive,
  };

  let locationId: string;
  try {
    locationId = id
      ? (await prisma.storageLocation.update({ where: { id }, data })).id
      : (await prisma.storageLocation.create({ data })).id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const msg = fmt(l.codeExists, { code });
      return { error: msg, fieldErrors: { zone: msg } };
    }
    console.error(e);
    return { error: t.common.saveFailed };
  }
  revalidateLocations();
  redirect(`/locations/${locationId}`);
}

export async function deleteLocation(id: string) {
  try {
    // products fall back to "no location"; count lines keep their locationCode snapshot
    await prisma.storageLocation.delete({ where: { id } });
  } catch (e) {
    console.error(e);
    return { error: (await getI18n()).t.common.deleteFailed };
  }
  revalidateLocations();
  redirect("/locations");
}
