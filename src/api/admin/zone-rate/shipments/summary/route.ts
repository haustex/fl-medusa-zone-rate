import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getTrackingOptions } from "../../../../../lib/plugin-options"
import { statusMachine } from "../../../../../lib/tracking/shipments"

/** Counts per status, late shipments (open past the estimate) and shipped today (store time zone) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const machine = statusMachine(req.scope)
  const tz = getTrackingOptions(req.scope).timeZone
  const rows: { status: string; count: string }[] = await pg("zone_rate_shipment").whereNull("deleted_at").select("status").count("* as count").groupBy("status")
  const final = [...machine.statuses.values()].filter((s) => s.next.length === 0).map((s) => s.id)
  const [{ count: late }] = await pg("zone_rate_shipment")
    .whereNull("deleted_at")
    .whereNotIn("status", final)
    .where("estimated_delivery_at", "<", new Date())
    .count("* as count")
  const [{ count: today }] = await pg("zone_rate_shipment")
    .whereNull("deleted_at")
    .whereRaw(`(shipped_at at time zone ?)::date = (now() at time zone ?)::date`, [tz, tz])
    .count("* as count")
  res.json({
    by_status: Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])),
    late: Number(late),
    shipped_today: Number(today),
    time_zone: tz,
  })
}
