import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ZONE_RATE_MODULE } from "../../../../../lib/tracking/shipments"
import { sendPhoto } from "../../../../zone-rate-photo"

/** A proof photo of a public event on the customer's own order */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  await sendPhoto(req, res, req.params.id, async (shipmentId) => {
    const shipment = await svc.retrieveZoneRateShipment(shipmentId).catch(() => null)
    if (!shipment) return false
    const { data } = await query.graph({ entity: "order", fields: ["customer_id"], filters: { id: shipment.order_id } })
    if (data[0]?.customer_id !== req.auth_context.actor_id) return false
    const events = await svc.listZoneRateShipmentEvents({ shipment_id: shipmentId, public: true })
    return events.some((e: { photo_ids: string[] | null }) => e.photo_ids?.includes(req.params.id))
  })
}
