import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ZoneRateProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [ZoneRateProviderService],
})
