import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ZONE_RATE_MODULE } from "../../../../../../lib/tracking/shipments"
import type { PostAdminShipmentPhotoType } from "../../../../../validators"

const MAX_BYTES = 5 * 1024 * 1024

/** Type from the file's first bytes, never from what the browser claims */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp"
  return null
}

/** Uploads a proof photo; attach its id to a status update (photo_ids) */
export async function POST(req: AuthenticatedMedusaRequest<PostAdminShipmentPhotoType>, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  await svc.retrieveZoneRateShipment(req.params.id)
  const m = /^data:[^;,]*;base64,([A-Za-z0-9+/=\s]+)$/.exec(req.validatedBody.data_url)
  if (!m) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Expected a base64 data URL")
  const buf = Buffer.from(m[1], "base64")
  if (buf.length > MAX_BYTES) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Photo is larger than 5 MB")
  const mime = sniffImage(buf)
  if (!mime) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Only JPEG, PNG or WebP photos")
  const photo = await svc.createZoneRateShipmentPhotos({
    shipment_id: req.params.id,
    mime_type: mime,
    size: buf.length,
    data: buf.toString("base64"),
    created_by: req.auth_context?.actor_id ?? null,
  })
  res.json({ photo: { id: photo.id, mime_type: mime, size: buf.length } })
}
