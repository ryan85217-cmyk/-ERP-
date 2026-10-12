"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { VarianceReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { VARIANCE_REASONS } from "@/lib/constants";
import { dayKey } from "@/lib/dates";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { emptyToNull, type FormState } from "./types";

export interface CountItemInput {
  id: string;
  actualQty: number | null;
  reason: VarianceReason | null;
  note: string | null;
}

export type CountActionResult = { ok: true; savedAt: string } | { ok: false; error: string };

const itemSchema = z.object({
  id: z.string().min(1),
  actualQty: z.number().int().min(0).nullable(),
  reason: z.enum(VARIANCE_REASONS as [VarianceReason, ...VarianceReason[]]).nullable(),
  note: z.string().max(500).nullable(),
});
const itemsSchema = z.array(itemSchema);

function revalidateCount(id?: string) {
  revalidatePath("/inventory-count", "layout");
  if (id) revalidatePath(`/inventory-count/${id}`);
  revalidatePath("/");
}

/** Recalculate counted / uncounted / total variance on the session. */
async function refreshSessionStats(sessionId: string) {
  const items = await prisma.inventoryCountItem.findMany({
    where: { sessionId },
    select: { actualQty: true, variance: true },
  });
  const counted = items.filter((i) => i.actualQty !== null);
  await prisma.inventoryCountSession.update({
    where: { id: sessionId },
    data: {
      countedCount: counted.length,
      uncountedCount: items.length - counted.length,
      totalVariance: counted.reduce((a, i) => a + (i.variance ?? 0), 0),
    },
  });
}

async function persistItems(sessionId: string, raw: CountItemInput[]) {
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) throw new Error((await getI18n()).t.count.formatError);
  const existing = await prisma.inventoryCountItem.findMany({
    where: { sessionId, id: { in: parsed.data.map((i) => i.id) } },
    select: { id: true, posQty: true, actualQty: true, reason: true, note: true },
  });
  const byId = new Map(existing.map((e) => [e.id, e]));
  const now = new Date();
  const updates = parsed.data
    .filter((i) => {
      const e = byId.get(i.id);
      return e && (e.actualQty !== i.actualQty || e.reason !== i.reason || (e.note ?? null) !== (i.note || null));
    })
    .map((i) => {
      const e = byId.get(i.id)!;
      // 盤差 = POS 原始庫存 - 手動實際庫存
      const variance = i.actualQty === null ? null : e.posQty - i.actualQty;
      return prisma.inventoryCountItem.update({
        where: { id: i.id },
        data: {
          actualQty: i.actualQty,
          variance,
          reason: variance ? i.reason : null,
          note: i.note || null,
          countedAt: i.actualQty === null ? null : now,
        },
      });
    });
  if (updates.length) await prisma.$transaction(updates);
  await refreshSessionStats(sessionId);
}

async function getEditableSession(id: string) {
  const { t } = await getI18n();
  const session = await prisma.inventoryCountSession.findUnique({ where: { id } });
  if (!session) throw new Error(t.count.notFound);
  if (session.status === "COMPLETED") throw new Error(t.count.locked);
  return { session, t };
}

async function fail(e: unknown): Promise<CountActionResult> {
  console.error(e);
  return { ok: false, error: e instanceof Error ? e.message : (await getI18n()).t.count.opFailed };
}

// ───────────────── create ─────────────────

export async function createCountSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const operator = emptyToNull(formData.get("operator"));
  const countDateRaw = emptyToNull(formData.get("countDate"));
  const note = emptyToNull(formData.get("note"));
  const scopeMode = formData.get("scopeMode") === "category" ? "category" : "zone";
  const categoryIds = scopeMode === "category" ? formData.getAll("categoryIds").map(String).filter(Boolean) : [];
  const zones = scopeMode === "zone" ? formData.getAll("zones").map(String).filter(Boolean).sort() : [];
  const startNow = formData.get("startNow") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!operator) fieldErrors.operator = t.count.operatorRequired;
  if (!countDateRaw || Number.isNaN(Date.parse(countDateRaw))) fieldErrors.countDate = t.count.dateRequired;
  if (Object.keys(fieldErrors).length) return { error: t.common.fixFields, fieldErrors };

  // countDate is a local (Asia/Taipei) calendar date
  const countDate = new Date(`${countDateRaw}T00:00:00+08:00`);

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categoryIds.length ? { categoryId: { in: categoryIds } } : {}),
      ...(zones.length ? { location: { zone: { in: zones } } } : {}),
    },
    include: { inventory: true, location: true },
  });
  if (products.length === 0) return { error: t.count.noProducts };

  // IC{yyyymmdd}-{nn}: continue after the highest number already used for that prefix
  const prefix = `IC${dayKey(countDate).replace(/-/g, "")}-`;
  const existing = await prisma.inventoryCountSession.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } });
  const maxSeq = Math.max(0, ...existing.map((s) => parseInt(s.code.slice(prefix.length), 10) || 0));
  const code = `${prefix}${String(maxSeq + 1).padStart(2, "0")}`;
  const now = new Date();

  const session = await prisma.inventoryCountSession.create({
    data: {
      code,
      countDate,
      operator: operator!,
      note,
      zones,
      status: startNow ? "IN_PROGRESS" : "DRAFT",
      startedAt: startNow ? now : null,
      countedCount: 0,
      uncountedCount: products.length,
      items: {
        create: products.map((p) => ({
          productId: p.id,
          // snapshots taken when the count is created: POS stock baseline and where the item sits
          posQty: p.inventory?.posStock ?? 0,
          locationId: p.locationId,
          locationCode: p.location?.code ?? null,
        })),
      },
    },
  });
  revalidateCount();
  redirect(`/inventory-count/${session.id}`);
}

// ───────────────── state transitions ─────────────────

export async function startCountSession(id: string): Promise<CountActionResult> {
  try {
    const { session: s, t } = await getEditableSession(id);
    if (s.status !== "DRAFT") throw new Error(t.count.onlyDraftStart);
    await prisma.inventoryCountSession.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    revalidateCount(id);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return await fail(e);
  }
}

export async function saveCountProgress(id: string, items: CountItemInput[]): Promise<CountActionResult> {
  try {
    const { session: s, t } = await getEditableSession(id);
    if (s.status === "PAUSED") throw new Error(t.count.pausedResumeFirst);
    await persistItems(id, items);
    if (s.status === "DRAFT") {
      await prisma.inventoryCountSession.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    }
    revalidateCount(id);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return await fail(e);
  }
}

export async function pauseCountSession(id: string, items: CountItemInput[]): Promise<CountActionResult> {
  try {
    const { session: s, t } = await getEditableSession(id);
    if (s.status !== "IN_PROGRESS") throw new Error(t.count.onlyInProgressPause);
    await persistItems(id, items);
    await prisma.inventoryCountSession.update({ where: { id }, data: { status: "PAUSED", pausedAt: new Date() } });
    revalidateCount(id);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return await fail(e);
  }
}

export async function resumeCountSession(id: string): Promise<CountActionResult> {
  try {
    const { session: s, t } = await getEditableSession(id);
    if (s.status !== "PAUSED") throw new Error(t.count.onlyPausedResume);
    await prisma.inventoryCountSession.update({ where: { id }, data: { status: "IN_PROGRESS", pausedAt: null } });
    revalidateCount(id);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return await fail(e);
  }
}

export async function completeCountSession(
  id: string,
  items: CountItemInput[],
  applyToStoreStock: boolean,
): Promise<CountActionResult> {
  try {
    const { session: s, t } = await getEditableSession(id);
    if (s.status === "PAUSED") throw new Error(t.count.pausedResumeFirst);
    await persistItems(id, items);
    const all = await prisma.inventoryCountItem.findMany({ where: { sessionId: id } });
    const uncounted = all.filter((i) => i.actualQty === null).length;
    if (uncounted > 0) throw new Error(fmt(t.count.uncountedLeft, { n: uncounted }));

    const now = new Date();
    const ops = [
      prisma.inventoryCountSession.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: now, startedAt: s.startedAt ?? now, pausedAt: null },
      }),
      ...(applyToStoreStock
        ? all.map((i) =>
            prisma.inventory.updateMany({
              where: { productId: i.productId },
              data: { storeStock: i.actualQty ?? 0, lastSyncedAt: now },
            }),
          )
        : []),
    ];
    await prisma.$transaction(ops);
    revalidateCount(id);
    revalidatePath("/inventory", "layout");
    revalidatePath("/locations", "layout");
    return { ok: true, savedAt: now.toISOString() };
  } catch (e) {
    return await fail(e);
  }
}

export async function deleteCountSession(id: string) {
  const { t } = await getI18n();
  const s = await prisma.inventoryCountSession.findUnique({ where: { id } });
  if (!s) return { error: t.count.notFound };
  if (s.status === "COMPLETED") return { error: t.count.completedNoDelete };
  await prisma.inventoryCountSession.delete({ where: { id } });
  revalidateCount();
  redirect("/inventory-count");
}
