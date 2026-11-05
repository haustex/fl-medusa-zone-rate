import type { ResolvedConfig } from "./config"
import { convertUp } from "./currency"
import { rejectionMessage } from "./messages"
import { matchProvince } from "./provinces"
import type { ExchangeRate, Locale, QuoteInput, QuoteRejection, QuoteResult, RejectionReason } from "./types"
import { chargeableWeight, resolveItems } from "./weight"

export function pickLocale(config: ResolvedConfig, cartLocale?: string | null, countryCode?: string | null): Locale {
  if (config.locale !== "auto") return config.locale
  const l = cartLocale?.toLowerCase()
  if (l?.startsWith("id")) return "id"
  if (l?.startsWith("en")) return "en"
  return countryCode?.toLowerCase() === "id" ? "id" : "en"
}

/**
 * Prices one service for a cart. Never returns an amount of 0: anything that
 * cannot be priced (unknown destination, a line without weight or a
 * dimension, no exchange rate) is a rejection with a message for the buyer.
 */
export function quote(config: ResolvedConfig, input: QuoteInput): QuoteResult {
  const country = input.country_code?.trim().toLowerCase() || null
  const rawProvince = input.province?.trim() || null
  const locale = pickLocale(config, input.locale, country)
  const service = config.services.get(input.service_id)
  const resolved = resolveItems(input.items, config.product_fallback)

  const reject = (reason: RejectionReason, vars: { currency?: string } = {}): QuoteRejection => ({
    ok: false,
    reason,
    service_id: input.service_id,
    locale,
    raw_province: rawProvince,
    country_code: country,
    incomplete: resolved.incomplete,
    message: rejectionMessage(reason, locale, {
      province: rawProvince,
      country,
      items: resolved.incomplete,
      ...vars,
    }),
  })

  if (!service) return reject("unknown_service")
  if (!input.items.length) return reject("no_items")
  if (!country) return reject("no_address")

  let destination: string
  let provinceCode: string | null = null
  if (service.destination === "province") {
    if (country !== service.country) return reject("unsupported_country")
    provinceCode = matchProvince(rawProvince)
    if (!provinceCode) return reject("unknown_province")
    destination = provinceCode
  } else {
    destination = country
  }
  const zone = service.zoneByDestination.get(destination)
  if (!zone) return reject(service.destination === "province" ? "unknown_province" : "unsupported_country")

  if (resolved.incomplete.length) return reject("incomplete_items")

  const weight = chargeableWeight(resolved.items, {
    divisor: service.volumetric_divisor,
    weightUnit: config.weightUnit,
    dimensionUnit: config.dimensionUnit,
    minimumKg: service.minimum_kg,
  })
  const base_amount = Math.max(weight.chargeable_kg * zone.rate_per_kg, service.minimum_charge ?? 0)

  const currency = input.currency_code.toLowerCase()
  let amount = base_amount
  let exchange_rate: ExchangeRate | null = null
  if (currency !== config.currency) {
    exchange_rate = config.exchange_rates[currency] ?? null
    if (!exchange_rate) return reject("no_exchange_rate", { currency })
    amount = convertUp(base_amount, exchange_rate.rate)
  }

  return {
    ok: true,
    service_id: service.id,
    zone_id: zone.id,
    province_code: provinceCode,
    country_code: country,
    ...weight,
    rate_per_kg: zone.rate_per_kg,
    base_amount,
    base_currency: config.currency,
    amount,
    currency_code: currency,
    exchange_rate,
  }
}
