import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/** Test app only (not part of the plugin): emit events to replay order.placed / payment.captured in e2e */
export async function POST(req: MedusaRequest<{ events: { name: string; data: Record<string, unknown> }[] }>, res: MedusaResponse) {
  const bus = req.scope.resolve(Modules.EVENT_BUS)
  await Promise.all((req.body?.events ?? []).map((e) => bus.emit({ name: e.name, data: e.data })))
  res.json({ emitted: req.body?.events?.length ?? 0 })
}
