import { prisma } from "@/lib/prisma";
import { getRemarketingSegment } from "@/lib/remarketing";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  const seg = getRemarketingSegment(segment);
  if (!seg) return new Response("Unknown segment", { status: 404 });
  const { t, locale } = await getI18n();

  const members = await prisma.member.findMany({ where: seg.where(new Date()), orderBy: { totalSpent: "desc" } });
  const lines = [
    t.members.csvHeader,
    ...members.map((m) =>
      [
        m.memberNumber,
        m.name,
        m.phone,
        m.email,
        t.enums.segment[m.segment],
        formatDate(m.joinedAt, locale),
        formatDate(m.lastPurchaseAt, locale),
        m.purchaseCount,
        m.totalSpent,
        m.avgOrderValue,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  // BOM so Excel opens UTF-8 CJK text correctly
  const body = "﻿" + lines.join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="remarketing-${seg.key}.csv"`,
    },
  });
}
