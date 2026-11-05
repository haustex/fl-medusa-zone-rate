import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { compressPhoto } from "../../../../../../lib/tracking/photos"
import { ZONE_RATE_MODULE } from "../../../../../../lib/tracking/shipments"
import type { PostAdminShipmentPhotoType } from "../../../../../validators"

/**
 * Uploads a proof photo (JPEG, PNG or WebP, at most 10 MB as sent), stored
 * compressed as WebP without metadata. Attach its id to a status update
 * (photo_ids, at most 5 per event).
 */
export async function POST(req: AuthenticatedMedusaRequest<PostAdminShipmentPhotoType>, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  await svc.retrieveZoneRateShipment(req.params.id)
  const m = /^data:[^;,]*;base64,([A-Za-z0-9+/=\s]+)$/.exec(req.validatedBody.data_url)
  if (!m) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Expected a base64 data URL")
  const photo = await compressPhoto(Buffer.from(m[1], "base64"))
  const row = await svc.createZoneRateShipmentPhotos({
    shipment_id: req.params.id,
    mime_type: photo.mime_type,
    size: photo.data.length,
    data: photo.data.toString("base64"),
    created_by: req.auth_context?.actor_id ?? null,
  })
  res.json({ photo: { id: row.id, mime_type: photo.mime_type, size: photo.data.length, width: photo.width, height: photo.height } })
}
