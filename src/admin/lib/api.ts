import { sdk } from "./client"

export type Localized = { en: string; id: string }

export type ConfigResponse =
  | { show_credit: boolean; configured: false }
  | {
      show_credit: boolean
      configured: true
      currency: string
      exchange_rates: Record<string, { rate: number; updated_at: string }>
      units: { weight: string; dimension: string }
      product_fallback: boolean
      services: {
        id: string
        name: Localized
        destination: "province" | "country"
        country: string | null
        volumetric_divisor: number
        minimum_kg: number
        minimum_charge: number | null
        estimate: { min: number; max: number; unit: "day" | "week" | "month" } | null
        notice: Localized | null
        zones: { id: string; name: Localized; rate_per_kg: number; destinations: { code: string; name: string }[] }[]
      }[]
    }

export type IncompleteVariant = {
  variant_id: string
  variant_title: string | null
  sku: string | null
  product_id: string
  product_title: string
  product_status: string
  missing: ("weight" | "length" | "width" | "height")[]
}

export type Rejection = {
  id: string
  cart_id: string | null
  service_id: string
  reason: string
  raw_province: string | null
  country_code: string | null
  variants: { variant_id: string; product_id: string | null; title: string | null; missing: string[] }[] | null
  message: string
  count: number
  last_seen_at: string
}

export const CONFIG_QUERY_KEY = ["zone-rate", "config"]

export const getConfig = () => sdk.client.fetch<ConfigResponse>("/admin/zone-rate/config")

export const listIncomplete = (offset: number, limit: number) =>
  sdk.client.fetch<{ variants: IncompleteVariant[]; count: number }>("/admin/zone-rate/incomplete-variants", {
    query: { offset, limit },
  })

export const listRejections = (offset: number, limit: number) =>
  sdk.client.fetch<{ rejections: Rejection[]; count: number }>("/admin/zone-rate/rejections", { query: { offset, limit } })

/** Downloads the CSV through the session cookie (a plain link would not send it on every setup). */
export async function downloadIncompleteCsv() {
  const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "")
  const adminUrl = `${window.location.origin}${window.location.pathname.split("/zone-rate")[0]}`
  const res = await fetch(`${base}/admin/zone-rate/incomplete-variants?format=csv&admin_url=${encodeURIComponent(adminUrl)}`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "incomplete-variants.csv"
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: currency.toLowerCase() === "idr" ? 0 : 2,
  }).format(amount)
}

export function formatDateTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  )
}
