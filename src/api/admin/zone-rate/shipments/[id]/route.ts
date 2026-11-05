import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { trackingUrl, ZONE_RATE_MODULE } from "../../../../../lib/tracking/shipments"
import type { PostAdminUpdateShipmentType } from "../../../../validators"

/** A shipment with its full timeline (newest first) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const shipment = await svc.retrieveZoneRateShipment(req.params.id)
  const events = await svc.listZoneRateShipmentEvents({ shipment_id: shipment.id }, { order: { occurred_at: "DESC", created_at: "DESC" } })
  res.json({ shipment: { ...shipment, tracking_url: trackingUrl(req.scope, shipment), events } })
}

/** Carrier details (third-party courier name, number, link) */
export async function POST(req: AuthenticatedMedusaRequest<PostAdminUpdateShipmentType>, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const c = req.validatedBody.carrier ?? {}
  if (c.tracking_url && !/^https?:\/\//i.test(c.tracking_url)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "link must start with http(s)://")
  const shipment = await svc.updateZoneRateShipments({
    id: req.params.id,
    ...(c.name !== undefined ? { carrier_name: c.name || null } : {}),
    ...(c.tracking_number !== undefined ? { carrier_tracking_number: c.tracking_number || null } : {}),
    ...(c.tracking_url !== undefined ? { carrier_tracking_url: c.tracking_url || null } : {}),
  })
  res.json({ shipment })
}
