import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import ZoneRateModule from "../modules/zoneRate"

/** shipment.order_id → order (read-only: no pivot table) */
export default defineLink(
  { linkable: ZoneRateModule.linkable.zoneRateShipment, field: "order_id" },
  OrderModule.linkable.order,
  { readOnly: true }
)
