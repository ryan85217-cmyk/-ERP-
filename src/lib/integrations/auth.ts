import { timingSafeEqual } from "node:crypto";

/**
 * Integration endpoints (called by n8n) are protected by a shared bearer token,
 * INTEGRATION_TOKEN. Returns an error Response, or null when the request may proceed.
 */
export function checkIntegrationToken(req: Request): Response | null {
  const expected = process.env.INTEGRATION_TOKEN;
  if (!expected) return Response.json({ error: "Integrations are not configured (INTEGRATION_TOKEN)" }, { status: 503 });
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
