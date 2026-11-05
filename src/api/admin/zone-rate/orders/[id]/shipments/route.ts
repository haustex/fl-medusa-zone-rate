import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { trackingUrl, ZONE_RATE_MODULE } from "../../../../../../lib/tracking/shipments"

/** Shipments of an order with their timelines, for the order page widget */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const shipments = await svc.listZoneRateShipments({ order_id: req.params.id }, { order: { created_at: "DESC" } })
  const events = shipments.length
    ? await svc.listZoneRateShipmentEvents({ shipment_id: shipments.map((s: { id: string }) => s.id) }, { order: { occurred_at: "DESC", created_at: "DESC" } })
    : []
  res.json({
    shipments: shipments.map((s: any) => ({
      ...s,
      tracking_url: trackingUrl(req.scope, s),
      events: events.filter((e: any) => e.shipment_id === s.id),
    })),
  })
}
