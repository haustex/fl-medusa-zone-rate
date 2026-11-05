import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateShipmentStatus } from "../../../../../../lib/tracking/shipments"
import { adminActor } from "../../../../../zone-rate-http"
import type { PostAdminShipmentStatusType } from "../../../../../validators"

/** Records the next status (refused when the transition is not allowed) */
export async function POST(req: AuthenticatedMedusaRequest<PostAdminShipmentStatusType>, res: MedusaResponse) {
  const b = req.validatedBody
  const result = await updateShipmentStatus(req.scope, {
    shipment_id: req.params.id,
    status: b.status,
    note: b.note,
    location: b.location,
    occurred_at: b.occurred_at,
    public: b.public,
    photo_ids: b.photo_ids,
    carrier: b.carrier ? { name: b.carrier.name, tracking_number: b.carrier.tracking_number, tracking_url: b.carrier.tracking_url } : undefined,
    actor: await adminActor(req),
  })
  res.json(result)
}
