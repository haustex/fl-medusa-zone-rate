export type Locale = "en" | "id"
export type Localized = string | { en: string; id?: string; [locale: string]: string | undefined }

export type WeightUnit = "g" | "kg" | "lb" | "oz"
export type DimensionUnit = "mm" | "cm" | "m" | "in"

export type Estimate = {
  min: number
  max: number
  unit: "day" | "week" | "month"
}

export type ZoneConfig = {
  /** Stable id, e.g. "jawa" */
  id: string
  name: Localized
  /** Price per chargeable kg, in the config's `currency`, as an integer (Rp30.000 → 30000) */
  rate_per_kg: number
  /**
   * Destinations of a `province` service: ISO 3166-2 codes ("ID-JT") or any
   * name/alias the matcher accepts ("Jawa Tengah", "Jateng").
   */
  provinces?: string[]
  /** Destinations of a `country` service: ISO 3166-1 alpha-2 codes ("us") */
  countries?: string[]
}

export type ServiceConfig = {
  /** Stable id, also the fulfillment option id, e.g. "domestic" */
  id: string
  name: Localized
  /** How the zone is picked: by the address's province (one country) or by its country */
  destination: "province" | "country"
  /** `province` services: the country they ship within. Default "id". */
  country?: string
  zones: ZoneConfig[]
  /** Volumetric divisor (cm³ per kg). Default: the config's `volumetric_divisor` (6000). */
  volumetric_divisor?: number
  /** Delivery time once shipped (production time is separate) */
  estimate?: Estimate
  /** Minimum charged weight in kg (integer). Default 1. */
  minimum_kg?: number
  /** Minimum price, in the config's `currency`. Default none. */
  minimum_charge?: number
  /** Text shown with the option (e.g. duties paid by the buyer) */
  notice?: Localized
}

export type ExchangeRate = {
  /** Units of the config's `currency` per 1 unit of this currency (IDR per USD: 16500) */
  rate: number
  /** When the rate was last set, ISO date ("2026-11-03"); shown in the Admin */
  updated_at: string
}

export type ZoneRateConfig = {
  /** Currency of every rate in this file. Default "idr". */
  currency?: string
  /** Fixed rates used when a cart is in another currency, keyed by lower-case code ("usd") */
  exchange_rates?: Record<string, ExchangeRate>
  units?: { weight?: WeightUnit; dimension?: DimensionUnit }
  /** Default 6000 */
  volumetric_divisor?: number
  /** Use the product's weight/dimensions when the variant has none. Default true. */
  product_fallback?: boolean
  /**
   * Language of the rejection messages: a fixed locale, or "auto" (the cart's
   * locale, then "id" for Indonesian addresses, else "en"). Default "auto".
   */
  locale?: Locale | "auto"
  services: ServiceConfig[]
}

/** A cart line as the calculator needs it */
export type QuoteItem = {
  variant_id: string
  product_id?: string | null
  title?: string | null
  quantity: number
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  /** Product values, used when `product_fallback` is on and the variant's is empty */
  product_weight?: number | null
  product_length?: number | null
  product_width?: number | null
  product_height?: number | null
}

export type QuoteInput = {
  service_id: string
  currency_code: string
  country_code?: string | null
  province?: string | null
  items: QuoteItem[]
  locale?: string | null
}

export type RejectionReason =
  | "unknown_service"
  | "no_address"
  | "unknown_province"
  | "unsupported_country"
  | "incomplete_items"
  | "no_items"
  | "no_exchange_rate"

export type IncompleteItem = {
  variant_id: string
  product_id?: string | null
  title?: string | null
  missing: ("weight" | "length" | "width" | "height")[]
}

export type QuoteSuccess = {
  ok: true
  service_id: string
  zone_id: string
  province_code: string | null
  country_code: string
  actual_grams: number
  /** Volumetric weight in grams, rounded up */
  volumetric_grams: number
  chargeable_kg: number
  rate_per_kg: number
  /** In the config's currency */
  base_amount: number
  base_currency: string
  /** In the cart's currency */
  amount: number
  currency_code: string
  exchange_rate: ExchangeRate | null
}

export type QuoteRejection = {
  ok: false
  reason: RejectionReason
  service_id: string
  message: string
  locale: Locale
  raw_province: string | null
  country_code: string | null
  incomplete: IncompleteItem[]
}

export type QuoteResult = QuoteSuccess | QuoteRejection
