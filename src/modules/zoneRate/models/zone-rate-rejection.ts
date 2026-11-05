import { model } from "@medusajs/framework/utils"

/**
 * Every time the provider refused to price shipping. Repeats for the same cart,
 * service, reason and details only bump `count`/`last_seen_at` (checkout asks
 * for prices on every render), see src/lib/rejection-log.ts.
 */
const ZoneRateRejection = model
  .define("zone_rate_rejection", {
    id: model.id({ prefix: "zrrej" }).primaryKey(),
    cart_id: model.text().nullable(),
    service_id: model.text(),
    reason: model.text(),
    /** Province as the buyer typed it */
    raw_province: model.text().nullable(),
    country_code: model.text().nullable(),
    /** [{ variant_id, product_id, title, missing: ["weight", …] }] */
    variants: model.json().nullable(),
    message: model.text(),
    /** sha1 of service + reason + province + variants, for de-duplication */
    signature: model.text(),
    count: model.number().default(1),
    last_seen_at: model.dateTime(),
  })
  .indexes([{ on: ["cart_id", "signature"] }, { on: ["last_seen_at"] }, { on: ["reason"] }])

export default ZoneRateRejection
