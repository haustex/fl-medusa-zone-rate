import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { localize, resolveConfig } from "../../../../lib/config"
import { getPluginOptions, getProviderConfig } from "../../../../lib/plugin-options"
import { getProvince } from "../../../../lib/provinces"

/** Rates, zones and the exchange rate as configured, for the Admin page (read-only) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const show_credit = getPluginOptions(req.scope).showCredit !== false
  const raw = getProviderConfig(req.scope)
  if (!raw) {
    res.json({ show_credit, configured: false })
    return
  }
  const config = resolveConfig(raw)
  res.json({
    show_credit,
    configured: true,
    currency: config.currency,
    exchange_rates: config.exchange_rates,
    units: { weight: config.weightUnit, dimension: config.dimensionUnit },
    product_fallback: config.product_fallback,
    services: [...config.services.values()].map((s) => ({
      id: s.id,
      name: { en: localize(s.name, "en"), id: localize(s.name, "id") },
      destination: s.destination,
      country: s.destination === "province" ? s.country : null,
      volumetric_divisor: s.volumetric_divisor,
      minimum_kg: s.minimum_kg,
      minimum_charge: s.minimum_charge ?? null,
      estimate: s.estimate ?? null,
      notice: s.notice ? { en: localize(s.notice, "en"), id: localize(s.notice, "id") } : null,
      zones: s.zones.map((z) => {
        const destinations = [...s.zoneByDestination.entries()].filter(([, zone]) => zone.id === z.id).map(([d]) => d)
        return {
          id: z.id,
          name: { en: localize(z.name, "en"), id: localize(z.name, "id") },
          rate_per_kg: z.rate_per_kg,
          destinations: destinations.map((d) => ({ code: d, name: s.destination === "province" ? getProvince(d)?.name ?? d : d.toUpperCase() })),
        }
      }),
    })),
  })
}
