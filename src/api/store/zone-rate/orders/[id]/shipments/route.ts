import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { customerTrackingView, statusMachine, trackingUrl, ZONE_RATE_MODULE } from "../../../../../../lib/tracking/shipments"
import { requestLocale } from "../../../../../zone-rate-http"

/** Shipments of the logged-in customer's own order (404 for anyone else's) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "customer_id"], filters: { id: req.params.id } })
  if (!data[0] || data[0].customer_id !== req.auth_context.actor_id) {
    res.status(404).json({ type: "not_found", message: "Order not found" })
    return
  }
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const machine = statusMachine(req.scope)
  const shipments = await svc.listZoneRateShipments({ order_id: req.params.id })
  const locale = requestLocale(req)
  const out: unknown[] = []
  for (const s of shipments) {
    const events = await svc.listZoneRateShipmentEvents({ shipment_id: s.id })
    out.push({ ...customerTrackingView(machine, s, events, locale), tracking_url: trackingUrl(req.scope, s) })
  }
  res.json({ shipments: out })
}
