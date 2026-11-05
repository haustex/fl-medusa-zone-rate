import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getProvince } from "../../../../../lib/provinces"
import { trackingUrl, ZONE_RATE_MODULE } from "../../../../../lib/tracking/shipments"
import type { PostAdminUpdateShipmentType } from "../../../../validators"

/** A shipment with its full timeline (newest first) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const shipment = await svc.retrieveZoneRateShipment(req.params.id)
  const events = await svc.listZoneRateShipmentEvents({ shipment_id: shipment.id }, { order: { occurred_at: "DESC", created_at: "DESC" } })
  // Items for the packing slip
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "created_at", "items.title", "items.product_title", "items.variant_title", "items.variant_sku", "items.detail.quantity", "items.quantity"],
    filters: { id: shipment.order_id },
  })
  const order = data[0] as any
  const province = shipment.destination?.province
  res.json({
    shipment: {
      ...shipment,
      tracking_url: trackingUrl(req.scope, shipment),
      province_name: province ? getProvince(province)?.name ?? province : null,
      events,
      order: order
        ? {
            id: order.id,
            display_id: order.display_id,
            created_at: order.created_at,
            items: (order.items ?? []).map((i: any) => ({
              title: i.product_title ?? i.title,
              variant_title: i.variant_title ?? null,
              sku: i.variant_sku ?? null,
              quantity: Number(i.quantity ?? i.detail?.quantity ?? 0),
            })),
          }
        : null,
    },
  })
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
