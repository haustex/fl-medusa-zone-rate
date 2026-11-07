import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getTrackingOptions } from "../../../../lib/plugin-options"
import { statusMachine } from "../../../../lib/tracking/shipments"
import { localize, resolveConfig } from "../../../../lib/config"
import { getBrandLogoUrl, getPluginOptions, getProviderConfig } from "../../../../lib/plugin-options"
import { getProvince } from "../../../../lib/provinces"

/** Rates, zones and the exchange rate as configured, for the Admin page (read-only) */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const show_credit = getPluginOptions(req.scope).showCredit !== false
  const tracking = await trackingInfo(req)
  const raw = getProviderConfig(req.scope)
  if (!raw) {
    res.json({ show_credit, configured: false, tracking })
    return
  }
  const config = resolveConfig(raw)
  res.json({
    show_credit,
    tracking,
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

/** Statuses (labels, allowed next) and the sender block (name or logo, address) of the shipping label and packing slip */
async function trackingInfo(req: AuthenticatedMedusaRequest) {
  const machine = statusMachine(req.scope)
  const opts = getTrackingOptions(req.scope)
  const label = getPluginOptions(req.scope).tracking?.label ?? {}
  let sender = { name: label.senderName ?? null, lines: label.senderAddress ?? null, phone: label.senderPhone ?? null, logo_url: getBrandLogoUrl(req.scope) } as {
    name: string | null
    lines: string[] | null
    phone: string | null
    logo_url: string | null
  }
  if (!sender.name || !sender.lines) {
    try {
      const [store] = await req.scope.resolve(Modules.STORE).listStores({}, { take: 1 })
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({ entity: "stock_location", fields: ["name", "address.*"], pagination: { take: 1 } })
      const a = (data[0] as { address?: Record<string, string | null> } | undefined)?.address ?? {}
      const province = a.province ? getProvince(a.province)?.name ?? a.province : null
      sender = {
        ...sender,
        name: sender.name ?? store?.name ?? null,
        lines: sender.lines ?? [a.address_1, a.address_2, [a.city, province].filter(Boolean).join(", "), [a.postal_code, a.country_code?.toUpperCase()].filter(Boolean).join(" ")].filter((l): l is string => !!l),
        phone: sender.phone ?? a.phone ?? null,
      }
    } catch {
      /* label falls back to what is configured */
    }
  }
  return {
    initial: machine.initial,
    time_zone: opts.timeZone,
    statuses: [...machine.statuses.values()].map((s) => ({
      id: s.id,
      label: { en: localize(s.label, "en"), id: localize(s.label, "id") },
      next: s.next,
      public: s.public ?? true,
      medusa: s.medusa ?? null,
      final: s.next.length === 0,
    })),
    sender,
  }
}
