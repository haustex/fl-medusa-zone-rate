import type { TrackingLocale } from "./core/labels"
import type { TrackingTheme } from "./core/theme"

/**
 * Store-specific settings of the tracking pages. The installer writes this file
 * once and never overwrites it: change paths, language and look here.
 */
export const trackingConfig: {
  /** Lookup page path per market (country code of the [countryCode] segment) */
  path: (countryCode: string) => string
  locale: (countryCode: string) => TrackingLocale
  /** Time zone of the dates shown */
  timeZone?: string
  theme?: Partial<TrackingTheme>
  provinceName?: (code: string) => string
} = {
  path: (countryCode) => `/${countryCode}/track`,
  locale: (countryCode) => (countryCode === "id" ? "id" : "en"),
  timeZone: undefined,
  theme: undefined,
}
