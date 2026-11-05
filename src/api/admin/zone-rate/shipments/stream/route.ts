import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { streamUpdates } from "../../../../zone-rate-http"

/** Live updates of every shipment for open Admin pages (SSE) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  streamUpdates(req, res, () => true)
}
