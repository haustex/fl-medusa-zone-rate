import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createShipmentForOrder, ZONE_RATE_MODULE } from "../../../../lib/tracking/shipments"
import { adminActor } from "../../../zone-rate-http"
import type { PostAdminCreateShipmentType } from "../../../validators"

/**
 * Shipments, newest status first. Filters: status, service_id, zone_id,
 * from/to (status date, ISO), late=true, q (tracking number, carrier number,
 * order number, name or e-mail).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const q = req.query as Record<string, string | undefined>
  const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100)
  const offset = Math.max(Number(q.offset) || 0, 0)
  const filters: Record<string, unknown> = {}
  if (q.status) filters.status = q.status.split(",")
  if (q.service_id) filters.service_id = q.service_id
  if (q.zone_id) filters.zone_id = q.zone_id
  if (q.from || q.to) filters.status_at = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(q.to) } : {}) }
  if (q.late === "true") filters.estimated_delivery_at = { $lt: new Date() }
  if (q.late === "true") filters.delivered_at = null
  const search = q.q?.trim()
  if (search) {
    const like = { $ilike: `%${search.replace(/[%_]/g, "")}%` }
    const or: Record<string, unknown>[] = [{ tracking_number: like }, { carrier_tracking_number: like }, { customer_name: like }, { email: like }]
    const n = Number(search.replace(/^#/, ""))
    if (Number.isInteger(n) && n > 0) or.push({ order_display_id: n })
    filters.$or = or
  }
  const [shipments, count] = await svc.listAndCountZoneRateShipments(filters, { order: { status_at: "DESC" }, take: limit, skip: offset })
  res.json({ shipments, count, limit, offset })
}

/** Creates the shipment of an order (or returns its open one) */
export async function POST(req: AuthenticatedMedusaRequest<PostAdminCreateShipmentType>, res: MedusaResponse) {
  const shipment = await createShipmentForOrder(req.scope, { order_id: req.validatedBody.order_id, actor: await adminActor(req) })
  res.json({ shipment })
}
