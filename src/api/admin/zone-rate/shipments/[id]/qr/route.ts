import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import QRCode from "qrcode"
import { trackingUrl, ZONE_RATE_MODULE } from "../../../../../../lib/tracking/shipments"

/** QR code (SVG markup) of the shipment's tracking page, or of its number when no page is configured; for the label */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ZONE_RATE_MODULE) as any
  const shipment = await svc.retrieveZoneRateShipment(req.params.id)
  const value = trackingUrl(req.scope, shipment) ?? shipment.tracking_number
  const svg = await QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
  res.json({ svg, value })
}
