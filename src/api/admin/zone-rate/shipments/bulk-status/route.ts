import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateShipmentStatus } from "../../../../../lib/tracking/shipments"
import { adminActor } from "../../../../zone-rate-http"
import type { PostAdminBulkStatusType } from "../../../../validators"

/** The same status for several shipments; each one is validated on its own */
export async function POST(req: AuthenticatedMedusaRequest<PostAdminBulkStatusType>, res: MedusaResponse) {
  const b = req.validatedBody
  const actor = await adminActor(req)
  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const id of [...new Set(b.ids)]) {
    try {
      await updateShipmentStatus(req.scope, { shipment_id: id, status: b.status, note: b.note, location: b.location, public: b.public, actor })
      results.push({ id, ok: true })
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message })
    }
  }
  res.json({ results, updated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length })
}
