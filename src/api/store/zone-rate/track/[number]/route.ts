import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseTrackingNumber } from "../../../../../lib/tracking/tracking-number"
import { publicTrackingView, statusMachine, ZONE_RATE_MODULE } from "../../../../../lib/tracking/shipments"
import { requestLocale } from "../../../../zone-rate-http"

/**
 * Public tracking by our tracking number (rate limited per IP). Only status,
 * city/province/country and times; 404 for anything else, including a number
 * with a wrong check symbol, so the response does not help guessing.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const number = parseTrackingNumber(req.params.number)
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const [shipment] = number ? await svc.listZoneRateShipments({ tracking_number: number }, { take: 1 }) : []
  if (!shipment) {
    res.status(404).json({ type: "not_found", message: "Tracking number not found" })
    return
  }
  const events = await svc.listZoneRateShipmentEvents({ shipment_id: shipment.id })
  res.setHeader("Cache-Control", "no-store")
  res.json({ shipment: publicTrackingView(statusMachine(req.scope), shipment, events, requestLocale(req)) })
}
