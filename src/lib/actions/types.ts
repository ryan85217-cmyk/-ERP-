export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

export const initialFormState: FormState = {};

import type { ZodError } from "zod";

export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Converts "" to undefined so optional fields stay null in DB */
export function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
