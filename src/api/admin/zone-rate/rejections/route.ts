import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { REJECTION_TABLE } from "../../../../lib/rejection-log"

/** The shipping rejection log, newest first. Filters: `reason`, `service_id`. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pg: Knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const base = pg(REJECTION_TABLE).whereNull("deleted_at")
  if (typeof req.query.reason === "string" && req.query.reason) base.where("reason", req.query.reason)
  if (typeof req.query.service_id === "string" && req.query.service_id) base.where("service_id", req.query.service_id)

  const [{ count }] = await base.clone().count<{ count: string }[]>({ count: "*" })
  const rows = await base
    .clone()
    .select("id", "cart_id", "service_id", "reason", "raw_province", "country_code", "variants", "message", "count", "last_seen_at", "created_at")
    .orderBy("last_seen_at", "desc")
    .limit(limit)
    .offset(offset)
  res.json({ rejections: rows, count: Number(count), limit, offset })
}
