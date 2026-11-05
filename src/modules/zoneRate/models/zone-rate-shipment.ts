import { model } from "@medusajs/framework/utils"
import ZoneRateShipmentEvent from "./zone-rate-shipment-event"

/**
 * One parcel of an order. `tracking_number` is ours (public lookup key);
 * a third-party carrier's number and link can be added next to it.
 * Destination, weight and price are snapshots taken when it was created.
 */
const ZoneRateShipment = model
  .define("zone_rate_shipment", {
    id: model.id({ prefix: "zrshp" }).primaryKey(),
    order_id: model.text(),
    order_display_id: model.number().nullable(),
    email: model.text().nullable(),
    customer_name: model.text().nullable(),
    fulfillment_id: model.text().nullable(),
    service_id: model.text().nullable(),
    zone_id: model.text().nullable(),
    tracking_number: model.text().unique(),
    carrier_name: model.text().nullable(),
    carrier_tracking_number: model.text().nullable(),
    carrier_tracking_url: model.text().nullable(),
    chargeable_kg: model.number().nullable(),
    shipping_amount: model.number().nullable(),
    currency_code: model.text().nullable(),
    /** { first_name, last_name, address_1, address_2, city, province, postal_code, country_code, phone } */
    destination: model.json().nullable(),
    /** { min, max, unit } of the service, for "late" */
    estimate: model.json().nullable(),
    status: model.text(),
    status_at: model.dateTime(),
    shipped_at: model.dateTime().nullable(),
    estimated_delivery_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
    locale: model.text().nullable(),
    metadata: model.json().nullable(),
    events: model.hasMany(() => ZoneRateShipmentEvent, { mappedBy: "shipment" }),
  })
  .indexes([
    { on: ["order_id"] },
    { on: ["status"] },
    { on: ["carrier_tracking_number"] },
    { on: ["status_at"] },
  ])

export default ZoneRateShipment
