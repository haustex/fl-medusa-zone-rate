import { matchProvince } from "./provinces"
import type { DimensionUnit, ExchangeRate, Locale, Localized, ServiceConfig, WeightUnit, ZoneConfig, ZoneRateConfig } from "./types"

export type ResolvedService = ServiceConfig & {
  country: string
  volumetric_divisor: number
  minimum_kg: number
  /** province code ("ID-JT") or country code ("us") → zone */
  zoneByDestination: Map<string, ZoneConfig>
}

export type ResolvedConfig = {
  currency: string
  exchange_rates: Record<string, ExchangeRate>
  weightUnit: WeightUnit
  dimensionUnit: DimensionUnit
  product_fallback: boolean
  locale: Locale | "auto"
  services: Map<string, ResolvedService>
}

const WEIGHT_UNITS: WeightUnit[] = ["g", "kg", "lb", "oz"]
const DIMENSION_UNITS: DimensionUnit[] = ["mm", "cm", "m", "in"]

export class ZoneRateConfigError extends Error {
  constructor(message: string) {
    super(`[zone-rate] invalid config: ${message}`)
    this.name = "ZoneRateConfigError"
  }
}

const positiveInt = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0

/** Validates the config once at startup, so a typo fails loudly instead of quoting 0. */
export function resolveConfig(config: ZoneRateConfig | undefined | null): ResolvedConfig {
  const fail = (m: string): never => {
    throw new ZoneRateConfigError(m)
  }
  if (!config || typeof config !== "object") fail("options are missing")
  const c = config as ZoneRateConfig
  if (!Array.isArray(c.services) || !c.services.length) fail("`services` must list at least one service")

  const weightUnit = c.units?.weight ?? "g"
  const dimensionUnit = c.units?.dimension ?? "cm"
  if (!WEIGHT_UNITS.includes(weightUnit)) fail(`units.weight must be one of ${WEIGHT_UNITS.join(", ")}`)
  if (!DIMENSION_UNITS.includes(dimensionUnit)) fail(`units.dimension must be one of ${DIMENSION_UNITS.join(", ")}`)
  const defaultDivisor = c.volumetric_divisor ?? 6000
  if (!positiveInt(defaultDivisor)) fail("volumetric_divisor must be a positive integer")
  if (c.locale && !["auto", "en", "id"].includes(c.locale)) fail('locale must be "auto", "en" or "id"')

  const exchange_rates: Record<string, ExchangeRate> = {}
  for (const [code, r] of Object.entries(c.exchange_rates ?? {})) {
    if (!r || !(typeof r.rate === "number" && Number.isFinite(r.rate) && r.rate > 0)) fail(`exchange_rates.${code}.rate must be a positive number`)
    if (!r.updated_at || Number.isNaN(Date.parse(r.updated_at))) fail(`exchange_rates.${code}.updated_at must be a date (YYYY-MM-DD)`)
    exchange_rates[code.toLowerCase()] = r
  }

  const services = new Map<string, ResolvedService>()
  for (const s of c.services) {
    if (!s?.id || !/^[a-z0-9][a-z0-9_-]*$/.test(s.id)) fail(`service id "${s?.id}" must be lower-case letters, digits, - or _`)
    if (services.has(s.id)) fail(`service id "${s.id}" is used twice`)
    if (!localizedOk(s.name)) fail(`service "${s.id}" needs a name`)
    if (s.destination !== "province" && s.destination !== "country") fail(`service "${s.id}": destination must be "province" or "country"`)
    const divisor = s.volumetric_divisor ?? defaultDivisor
    if (!positiveInt(divisor)) fail(`service "${s.id}": volumetric_divisor must be a positive integer`)
    const minimum_kg = s.minimum_kg ?? 1
    if (!positiveInt(minimum_kg)) fail(`service "${s.id}": minimum_kg must be a positive integer`)
    if (s.minimum_charge !== undefined && !(Number.isInteger(s.minimum_charge) && s.minimum_charge >= 0))
      fail(`service "${s.id}": minimum_charge must be a non-negative integer`)
    if (s.estimate && !(positiveInt(s.estimate.min) && positiveInt(s.estimate.max) && s.estimate.min <= s.estimate.max))
      fail(`service "${s.id}": estimate needs whole min <= max`)
    if (!Array.isArray(s.zones) || !s.zones.length) fail(`service "${s.id}" needs at least one zone`)

    const zoneByDestination = new Map<string, ZoneConfig>()
    const zoneIds = new Set<string>()
    for (const z of s.zones) {
      if (!z?.id || zoneIds.has(z.id)) fail(`service "${s.id}": zone id "${z?.id}" is missing or used twice`)
      zoneIds.add(z.id)
      if (!localizedOk(z.name)) fail(`zone "${s.id}/${z.id}" needs a name`)
      if (!positiveInt(z.rate_per_kg)) fail(`zone "${s.id}/${z.id}": rate_per_kg must be a positive integer (no 0, no decimals)`)
      const destinations =
        s.destination === "province"
          ? (z.provinces ?? []).map((p) => matchProvince(p) ?? fail(`zone "${s.id}/${z.id}": unknown province "${p}"`))
          : (z.countries ?? []).map((cc) =>
              /^[a-z]{2}$/i.test(cc) ? cc.toLowerCase() : fail(`zone "${s.id}/${z.id}": "${cc}" is not a 2-letter country code`)
            )
      if (!destinations.length) fail(`zone "${s.id}/${z.id}" lists no ${s.destination === "province" ? "provinces" : "countries"}`)
      for (const d of destinations) {
        const other = zoneByDestination.get(d)
        if (other) fail(`service "${s.id}": ${d} is in zones "${other.id}" and "${z.id}"`)
        zoneByDestination.set(d, z)
      }
    }

    services.set(s.id, {
      ...s,
      country: (s.country ?? "id").toLowerCase(),
      volumetric_divisor: divisor,
      minimum_kg,
      zoneByDestination,
    })
  }

  return {
    currency: (c.currency ?? "idr").toLowerCase(),
    exchange_rates,
    weightUnit,
    dimensionUnit,
    product_fallback: c.product_fallback ?? true,
    locale: c.locale ?? "auto",
    services,
  }
}

function localizedOk(v: Localized | undefined): boolean {
  return typeof v === "string" ? v.trim().length > 0 : !!v && typeof v.en === "string" && v.en.trim().length > 0
}

export function localize(v: Localized | undefined, locale: Locale): string {
  if (!v) return ""
  if (typeof v === "string") return v
  return v[locale] ?? v.en
}
