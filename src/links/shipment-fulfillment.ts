import { defineLink } from "@medusajs/framework/utils"
import FulfillmentModule from "@medusajs/medusa/fulfillment"
import ZoneRateModule from "../modules/zoneRate"

/** shipment.fulfillment_id → Medusa fulfillment (read-only) */
export default defineLink(
  { linkable: ZoneRateModule.linkable.zoneRateShipment, field: "fulfillment_id" },
  FulfillmentModule.linkable.fulfillment,
  { readOnly: true }
)
