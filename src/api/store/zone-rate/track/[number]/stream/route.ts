import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseTrackingNumber } from "../../../../../../lib/tracking/tracking-number"
import { ZONE_RATE_MODULE } from "../../../../../../lib/tracking/shipments"
import { streamUpdates } from "../../../../../zone-rate-http"

/** Live updates of one tracking number (SSE): a ping to re-fetch, no data beyond the status */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const number = parseTrackingNumber(req.params.number)
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const [shipment] = number ? await svc.listZoneRateShipments({ tracking_number: number }, { take: 1 }) : []
  if (!shipment) {
    res.status(404).json({ type: "not_found", message: "Tracking number not found" })
    return
  }
  streamUpdates(
    req,
    res,
    (u) => u.shipment_id === shipment.id && u.public,
    (u) => ({ tracking_number: u.tracking_number, status: u.status, at: u.at })
  )
}
