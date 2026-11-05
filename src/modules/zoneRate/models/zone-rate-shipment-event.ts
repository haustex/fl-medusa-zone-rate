import { model } from "@medusajs/framework/utils"
import ZoneRateShipment from "./zone-rate-shipment"

/** Append-only timeline entry of a shipment */
const ZoneRateShipmentEvent = model
  .define("zone_rate_shipment_event", {
    id: model.id({ prefix: "zrevt" }).primaryKey(),
    status: model.text(),
    previous_status: model.text().nullable(),
    note: model.text().nullable(),
    location: model.text().nullable(),
    /** When it happened (may be earlier than recorded) */
    occurred_at: model.dateTime(),
    created_by: model.text().nullable(),
    created_by_name: model.text().nullable(),
    /** Shown on the buyer's tracking page and e-mailed */
    public: model.boolean().default(true),
    photo_ids: model.json().nullable(),
    notified_at: model.dateTime().nullable(),
    shipment: model.belongsTo(() => ZoneRateShipment, { mappedBy: "events" }),
  })
  .indexes([{ on: ["occurred_at"] }])

export default ZoneRateShipmentEvent
