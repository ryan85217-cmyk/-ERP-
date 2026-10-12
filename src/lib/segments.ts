import type { MemberSegment } from "@prisma/client";

const DAY = 86_400_000;

export interface SegmentInput {
  joinedAt: Date;
  lastPurchaseAt: Date | null;
  purchaseCount: number;
}

/**
 * Member auto-classification rules:
 *  1. INACTIVE  — never purchased or last purchase > 90 days ago (unless joined ≤ 30 days → NEW)
 *  2. NEW       — joined ≤ 30 days ago, or only 1 purchase so far
 *  3. ACTIVE    — purchased within 30 days and ≥ 6 purchases
 *  4. RETURNING — everyone else (≥ 2 purchases, active within 90 days)
 */
export function classifyMember(m: SegmentInput, now: Date = new Date()): MemberSegment {
  const daysSinceJoin = (now.getTime() - m.joinedAt.getTime()) / DAY;
  const daysSinceLast = m.lastPurchaseAt ? (now.getTime() - m.lastPurchaseAt.getTime()) / DAY : Infinity;

  if (daysSinceLast > 90) return daysSinceJoin <= 30 ? "NEW" : "INACTIVE";
  if (daysSinceJoin <= 30 || m.purchaseCount <= 1) return "NEW";
  if (daysSinceLast <= 30 && m.purchaseCount >= 6) return "ACTIVE";
  return "RETURNING";
}
