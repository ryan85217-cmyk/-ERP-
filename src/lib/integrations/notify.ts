import { countCompletedReport } from "./reports";

/**
 * Tells n8n a stock count was completed by POSTing the count summary to
 * N8N_COUNT_COMPLETED_WEBHOOK (with the integration token). Never throws:
 * a failing webhook must not undo or block completing the count.
 */
export async function notifyCountCompleted(sessionId: string) {
  const url = process.env.N8N_COUNT_COMPLETED_WEBHOOK;
  if (!url) return;
  try {
    const report = await countCompletedReport(sessionId);
    if (!report) return;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INTEGRATION_TOKEN ?? ""}` },
      body: JSON.stringify({ event: "count.completed", ...report }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[n8n] count webhook responded ${res.status}`);
  } catch (e) {
    console.error("[n8n] count webhook failed", e);
  }
}
