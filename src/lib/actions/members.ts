"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyMember } from "@/lib/segments";
import { getI18n } from "@/i18n/server";
import { emptyToNull, zodFieldErrors, type FormState } from "./types";

export async function saveMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const memberSchema = z.object({
    name: z.string().trim().min(1, t.members.nameRequired).max(60),
    phone: z
      .string()
      .trim()
      .regex(/^09\d{8}$/, t.members.phoneInvalid),
    email: z.string().email(t.common.invalidEmail).nullable(),
  });
  const id = emptyToNull(formData.get("id"));
  const parsed = memberSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: String(formData.get("phone") ?? "").replace(/[\s-]/g, ""),
    email: emptyToNull(formData.get("email")),
  });
  if (!parsed.success) return { error: t.common.fixFields, fieldErrors: zodFieldErrors(parsed.error) };

  let memberId: string;
  try {
    if (id) {
      memberId = (await prisma.member.update({ where: { id }, data: parsed.data })).id;
    } else {
      const last = await prisma.member.findFirst({ orderBy: { memberNumber: "desc" }, select: { memberNumber: true } });
      const next = (last ? Number(last.memberNumber.replace(/\D/g, "")) : 0) + 1;
      memberId = (
        await prisma.member.create({
          data: { ...parsed.data, memberNumber: `M${String(next).padStart(6, "0")}`, joinedAt: new Date(), segment: "NEW" },
        })
      ).id;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: t.members.phoneExists, fieldErrors: { phone: t.members.phoneExistsField } };
    }
    console.error(e);
    return { error: t.common.saveFailed };
  }
  revalidatePath("/members", "layout");
  redirect(`/members/${memberId}`);
}

export async function deleteMember(id: string) {
  try {
    await prisma.member.delete({ where: { id } });
  } catch (e) {
    console.error(e);
    return { error: (await getI18n()).t.common.deleteFailed };
  }
  revalidatePath("/members", "layout");
  redirect("/members");
}

/** Recompute purchase stats from orders and re-run the auto-classification for every member. */
export async function recalculateMemberSegments() {
  const now = new Date();
  const [members, stats] = await Promise.all([
    prisma.member.findMany({ select: { id: true, joinedAt: true } }),
    prisma.order.groupBy({
      by: ["memberId"],
      where: { memberId: { not: null } },
      _count: { _all: true },
      _sum: { total: true },
      _max: { orderedAt: true },
    }),
  ]);
  const byId = new Map(stats.map((s) => [s.memberId, s]));
  const updates = members.map((m) => {
    const s = byId.get(m.id);
    const purchaseCount = s?._count._all ?? 0;
    const totalSpent = s?._sum.total ?? 0;
    const lastPurchaseAt = s?._max.orderedAt ?? null;
    return prisma.member.update({
      where: { id: m.id },
      data: {
        purchaseCount,
        totalSpent,
        lastPurchaseAt,
        avgOrderValue: purchaseCount ? Math.round(totalSpent / purchaseCount) : 0,
        segment: classifyMember({ joinedAt: m.joinedAt, lastPurchaseAt, purchaseCount }, now),
      },
    });
  });
  for (let i = 0; i < updates.length; i += 200) {
    await prisma.$transaction(updates.slice(i, i + 200));
  }
  revalidatePath("/members", "layout");
  revalidatePath("/");
}
