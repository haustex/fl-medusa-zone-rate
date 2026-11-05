import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import fs from "node:fs"

/** Two regions, one stock location with ID/US zones, the three zone-rate options, and products with/without dimensions. */
export default async function seed({ container }: ExecArgs) {
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const storeModule = container.resolve(Modules.STORE)

  const [store] = await storeModule.listStores()
  const {
    result: [channel],
  } = await createSalesChannelsWorkflow(container).run({ input: { salesChannelsData: [{ name: "Web" }] } })
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: channel.id,
        supported_currencies: [{ currency_code: "idr", is_default: true }, { currency_code: "usd" }],
      },
    },
  })

  const { result: regions } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        { name: "Indonesia", currency_code: "idr", countries: ["id"], payment_providers: ["pp_system_default"] },
        { name: "United States", currency_code: "usd", countries: ["us"], payment_providers: ["pp_system_default"] },
      ],
    },
  })

  const {
    result: [location],
  } = await createStockLocationsWorkflow(container).run({
    input: { locations: [{ name: "Jepara", address: { address_1: "Jepara", country_code: "id" } }] },
  })
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "zone-rate_zone-rate" },
  })
  await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: location.id, add: [channel.id] } })

  const [profile] = await fulfillment.listShippingProfiles({ type: "default" })
  const shippingProfile = profile ?? (await fulfillment.createShippingProfiles({ name: "Default", type: "default" }))
  const set = await fulfillment.createFulfillmentSets({
    name: "Jepara",
    type: "shipping",
    service_zones: [
      { name: "Indonesia", geo_zones: [{ type: "country", country_code: "id" }] },
      { name: "United States", geo_zones: [{ type: "country", country_code: "us" }] },
    ],
  })
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
  })
  const zone = (name: string) => set.service_zones.find((z) => z.name === name)!.id
  const option = (name: string, service: string, zoneName: string) => ({
    name,
    price_type: "calculated" as const,
    provider_id: "zone-rate_zone-rate",
    service_zone_id: zone(zoneName),
    shipping_profile_id: shippingProfile.id,
    type: { label: name, description: service, code: service },
    data: { id: service },
    rules: [
      { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
      { attribute: "is_return", value: "false", operator: "eq" as const },
    ],
  })
  await createShippingOptionsWorkflow(container).run({
    input: [
      option("Pengiriman Haus Kayu", "domestic", "Indonesia"),
      option("Air Freight", "air", "United States"),
      option("Sea Freight", "sea", "United States"),
    ],
  })

  const product = (title: string, handle: string, variant: Record<string, unknown>) => ({
    title,
    handle,
    status: "published" as const,
    shipping_profile_id: shippingProfile.id,
    sales_channels: [{ id: channel.id }],
    options: [{ title: "Size", values: ["One"] }],
    variants: [
      {
        title: "One",
        options: { Size: "One" },
        manage_inventory: false,
        prices: [
          { amount: 150000, currency_code: "idr" },
          { amount: 15, currency_code: "usd" },
        ],
        ...variant,
      },
    ],
  })
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: [
        // 1.2 kg, 30×20×3 cm (0.3 kg volumetric) → 2 kg
        product("Talenan", "talenan", { weight: 1200, length: 30, width: 20, height: 3 }),
        // 600 g and no dimensions → refused
        product("Mangkuk", "mangkuk", { weight: 600 }),
      ],
    },
  })

  const {
    result: [key],
  } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "" }] },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: key.id, add: [channel.id] } })

  const out = process.env.ZR_SEED_OUT
  const data = {
    publishable_key: key.token,
    regions: Object.fromEntries(regions.map((r) => [r.currency_code, r.id])),
    variants: Object.fromEntries(products.map((p) => [p.handle, p.variants[0].id])),
  }
  if (out) fs.writeFileSync(out, JSON.stringify(data, null, 2))
}
