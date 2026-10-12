import type { Prisma } from "@prisma/client";
import { HIGH_VALUE_THRESHOLD } from "@/lib/constants";

export type RemarketingKey = "new" | "returning" | "high_value" | "dormant_90";

export interface RemarketingSegment {
  key: RemarketingKey;
  where: (now: Date) => Prisma.MemberWhereInput;
}

const DAY = 86_400_000;

export const REMARKETING_SEGMENTS: RemarketingSegment[] = [
  {
    key: "new",
    where: () => ({ segment: "NEW" }),
  },
  {
    key: "returning",
    where: (now) => ({ purchaseCount: { gte: 2 }, lastPurchaseAt: { gte: new Date(now.getTime() - 90 * DAY) } }),
  },
  {
    key: "high_value",
    where: () => ({ totalSpent: { gte: HIGH_VALUE_THRESHOLD } }),
  },
  {
    key: "dormant_90",
    where: (now) => ({ purchaseCount: { gte: 1 }, lastPurchaseAt: { lt: new Date(now.getTime() - 90 * DAY) } }),
  },
];

export function getRemarketingSegment(key: string | undefined) {
  return REMARKETING_SEGMENTS.find((s) => s.key === key);
}
