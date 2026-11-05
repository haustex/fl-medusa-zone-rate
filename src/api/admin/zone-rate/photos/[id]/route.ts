import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendPhoto } from "../../../../zone-rate-photo"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await sendPhoto(req, res, req.params.id)
}
