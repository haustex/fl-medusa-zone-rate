import { MedusaService } from "@medusajs/framework/utils"
import ZoneRateRejection from "./models/zone-rate-rejection"
import ZoneRateShipment from "./models/zone-rate-shipment"
import ZoneRateShipmentEvent from "./models/zone-rate-shipment-event"
import ZoneRateShipmentPhoto from "./models/zone-rate-shipment-photo"

class ZoneRateModuleService extends MedusaService({
  ZoneRateRejection,
  ZoneRateShipment,
  ZoneRateShipmentEvent,
  ZoneRateShipmentPhoto,
}) {}

export default ZoneRateModuleService
