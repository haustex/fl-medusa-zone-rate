import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveConfig, localize } from "../../../../lib/config"
import { convertUp } from "../../../../lib/currency"
import { getProviderConfig } from "../../../../lib/plugin-options"
import { getProvince } from "../../../../lib/provinces"
import { requestLocale } from "../../../zone-rate-http"

/**
 * Public rate card for shipping-info pages: services, zones, per-kg rates
 * (also converted to `?currency=` at the fixed rate, rounded up), estimates,
 * notices and the chargeable-weight rule. The same config checkout prices from.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = getProviderConfig(req.scope)
  if (!raw) {
    res.json({ services: [] })
    return
  }
  const config = resolveConfig(raw)
  const l = requestLocale(req)
  const currency = typeof req.query.currency === "string" ? req.query.currency.toLowerCase() : config.currency
  const rate = currency === config.currency ? null : config.exchange_rates[currency] ?? null
  const inCurrency = (amount: number) => (currency === config.currency ? amount : rate ? convertUp(amount, rate.rate) : null)
  res.setHeader("Cache-Control", "public, max-age=300")
  res.json({
    base_currency: config.currency,
    currency: currency === config.currency || rate ? currency : config.currency,
    exchange_rate: rate,
    units: { weight: config.weightUnit, dimension: config.dimensionUnit },
    services: [...config.services.values()].map((s) => ({
      id: s.id,
      name: localize(s.name, l),
      destination: s.destination,
      estimate: s.estimate ?? null,
      notice: s.notice ? localize(s.notice, l) : null,
      volumetric_divisor: s.volumetric_divisor,
      minimum_kg: s.minimum_kg,
      minimum_charge: s.minimum_charge != null ? inCurrency(s.minimum_charge) : null,
      zones: s.zones.map((z) => ({
        id: z.id,
        name: localize(z.name, l),
        rate_per_kg: inCurrency(z.rate_per_kg),
        rate_per_kg_base: z.rate_per_kg,
        destinations: [...s.zoneByDestination.entries()]
          .filter(([, zone]) => zone.id === z.id)
          .map(([d]) => (s.destination === "province" ? getProvince(d)?.name ?? d : d.toUpperCase())),
      })),
    })),
  })
}
