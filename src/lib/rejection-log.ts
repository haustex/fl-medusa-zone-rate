import { createHash } from "node:crypto"
import type { Logger } from "@medusajs/framework/types"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { generateEntityId } from "@medusajs/framework/utils"
import type { QuoteRejection } from "./types"

export const REJECTION_TABLE = "zone_rate_rejection"

export function rejectionSignature(r: QuoteRejection): string {
  const parts = [
    r.service_id,
    r.reason,
    (r.raw_province ?? "").toLowerCase(),
    r.country_code ?? "",
    ...r.incomplete.map((i) => `${i.variant_id}:${i.missing.join("+")}`).sort(),
  ]
  return createHash("sha1").update(parts.join("|")).digest("hex")
}

/**
 * Logs a refused quote. Runs inside the Fulfillment Module's container through
 * the shared `__pg_connection__` (the provider cannot resolve other modules).
 * Never throws: a logging failure must not change what the buyer sees.
 */
export async function recordRejection(
  pg: Knex | undefined,
  logger: Logger | undefined,
  input: { cart_id: string | null; rejection: QuoteRejection; now?: Date }
): Promise<"inserted" | "updated" | "skipped"> {
  const r = input.rejection
  if (!pg) {
    logger?.warn(`[zone-rate] shipping refused (${r.reason}) for cart ${input.cart_id ?? "-"}; no database to log it`)
    return "skipped"
  }
  const now = input.now ?? new Date()
  const signature = rejectionSignature(r)
  try {
    const updated = await pg(REJECTION_TABLE)
      .where({ signature, deleted_at: null })
      .andWhere((q) => (input.cart_id ? q.where("cart_id", input.cart_id) : q.whereNull("cart_id")))
      .update({ count: pg.raw("count + 1"), last_seen_at: now, updated_at: now })
    if (updated) return "updated"
    await pg(REJECTION_TABLE).insert({
      id: generateEntityId(undefined, "zrrej"),
      cart_id: input.cart_id,
      service_id: r.service_id,
      reason: r.reason,
      raw_province: r.raw_province,
      country_code: r.country_code,
      variants: r.incomplete.length ? JSON.stringify(r.incomplete) : null,
      message: r.message,
      signature,
      count: 1,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    })
    return "inserted"
  } catch (e) {
    logger?.warn(`[zone-rate] could not log a shipping rejection: ${(e as Error).message}`)
    return "skipped"
  }
}
