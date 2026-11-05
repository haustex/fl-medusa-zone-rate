import { Module } from "@medusajs/framework/utils"
import ZoneRateModuleService from "./service"

export const ZONE_RATE_MODULE = "zoneRate"

export default Module(ZONE_RATE_MODULE, {
  service: ZoneRateModuleService,
})
