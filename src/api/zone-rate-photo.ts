import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ZONE_RATE_MODULE } from "../lib/tracking/shipments"

/** Streams a stored proof photo with headers that stop it being sniffed or cached publicly */
export async function sendPhoto(req: MedusaRequest, res: MedusaResponse, id: string, allowed?: (shipmentId: string) => Promise<boolean>) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const [photo] = await svc.listZoneRateShipmentPhotos({ id }, { take: 1 })
  if (!photo || (allowed && !(await allowed(photo.shipment_id)))) {
    res.status(404).json({ type: "not_found", message: "Photo not found" })
    return
  }
  res.setHeader("Content-Type", photo.mime_type)
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "private, max-age=3600")
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox")
  res.send(Buffer.from(photo.data, "base64"))
}
