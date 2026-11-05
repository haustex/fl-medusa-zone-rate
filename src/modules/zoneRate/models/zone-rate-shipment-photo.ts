import { model } from "@medusajs/framework/utils"

/**
 * Proof photos (parcel, hand-over), kept in the database rather than the File
 * Module: the local file provider serves everything publicly, and these may
 * show a full address label. Admins open them through the Admin API; buyers
 * only through their own order.
 */
const ZoneRateShipmentPhoto = model
  .define("zone_rate_shipment_photo", {
    id: model.id({ prefix: "zrpho" }).primaryKey(),
    shipment_id: model.text(),
    mime_type: model.text(),
    size: model.number(),
    data: model.text(),
    created_by: model.text().nullable(),
  })
  .indexes([{ on: ["shipment_id"] }])

export default ZoneRateShipmentPhoto
