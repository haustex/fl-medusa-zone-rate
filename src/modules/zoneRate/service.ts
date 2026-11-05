import { MedusaService } from "@medusajs/framework/utils"
import ZoneRateRejection from "./models/zone-rate-rejection"

class ZoneRateModuleService extends MedusaService({
  ZoneRateRejection,
}) {}

export default ZoneRateModuleService
