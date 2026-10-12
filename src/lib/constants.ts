import type { CountStatus, LocationType, MemberSegment, VarianceReason } from "@prisma/client";

// Display labels live in src/i18n/messages/enums.ts; this file keeps only logic & styling constants.

export const COUNT_STATUS_VARIANT: Record<CountStatus, "secondary" | "info" | "warning" | "success"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "info",
  PAUSED: "warning",
  COMPLETED: "success",
};

export const VARIANCE_REASONS: VarianceReason[] = [
  "DAMAGED",
  "EXPIRED",
  "THEFT",
  "MISCOUNT",
  "SYSTEM_ERROR",
  "UNRECORDED_SALE",
  "SUPPLIER_SHORTAGE",
  "OTHER",
];

export const SEGMENTS: MemberSegment[] = ["NEW", "ACTIVE", "RETURNING", "INACTIVE"];

export const SEGMENT_VARIANT: Record<MemberSegment, "info" | "success" | "default" | "secondary"> = {
  NEW: "info",
  ACTIVE: "success",
  RETURNING: "default",
  INACTIVE: "secondary",
};

export const LOCATION_TYPES: LocationType[] = ["SHELF", "DISPLAY", "CHILLED", "FROZEN", "BACKROOM"];

export const LOCATION_TYPE_VARIANT: Record<LocationType, "secondary" | "success" | "info" | "default" | "outline"> = {
  SHELF: "secondary",
  DISPLAY: "success",
  CHILLED: "info",
  FROZEN: "default",
  BACKROOM: "outline",
};

/** Products whose store stock exceeds safetyStock × this factor are "high stock" */
export const HIGH_STOCK_FACTOR = 4;

/** High-value member threshold (lifetime spend, NT$) */
export const HIGH_VALUE_THRESHOLD = 15000;
