import { sdk } from "./client"

export type Localized = { en: string; id: string }

export type ConfigResponse =
  | { show_credit: boolean; configured: false; tracking: TrackingInfo }
  | {
      show_credit: boolean
      tracking: TrackingInfo
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

/* ---------- Tracking ---------- */

export type StatusInfo = {
  id: string
  label: Localized
  next: string[]
  public: boolean
  medusa: "shipped" | "delivered" | "canceled" | null
  final: boolean
}

export type TrackingInfo = {
  initial: string
  time_zone: string
  statuses: StatusInfo[]
  sender: { name: string | null; lines: string[] | null; phone: string | null; logo_url: string | null }
}

export type ShipmentEvent = {
  id: string
  status: string
  previous_status: string | null
  note: string | null
  location: string | null
  occurred_at: string
  created_by_name: string | null
  public: boolean
  photo_ids: string[] | null
  notified_at: string | null
}

export type Shipment = {
  id: string
  order_id: string
  order_display_id: number | null
  email: string | null
  customer_name: string | null
  fulfillment_id: string | null
  service_id: string | null
  zone_id: string | null
  tracking_number: string
  tracking_url?: string | null
  carrier_name: string | null
  carrier_tracking_number: string | null
  carrier_tracking_url: string | null
  chargeable_kg: number | null
  shipping_amount: number | null
  currency_code: string | null
  destination: Record<string, string | null> | null
  province_name?: string | null
  estimate: { min: number; max: number; unit: "day" | "week" | "month" } | null
  status: string
  status_at: string
  shipped_at: string | null
  estimated_delivery_at: string | null
  delivered_at: string | null
  created_at: string
  events?: ShipmentEvent[]
  order?: { id: string; display_id: number; created_at: string; items: { title: string; variant_title: string | null; sku: string | null; quantity: number }[] } | null
}

export type ShipmentFilters = { status?: string; service_id?: string; zone_id?: string; from?: string; to?: string; late?: boolean; q?: string }

export const SHIPMENTS_KEY = ["zone-rate", "shipments"]

export const listShipments = (f: ShipmentFilters, offset: number, limit: number) =>
  sdk.client.fetch<{ shipments: Shipment[]; count: number }>("/admin/zone-rate/shipments", {
    query: { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "" && v !== false)), offset, limit },
  })

export const getSummary = () =>
  sdk.client.fetch<{ by_status: Record<string, number>; late: number; shipped_today: number }>("/admin/zone-rate/shipments/summary")

export const getShipment = (id: string) => sdk.client.fetch<{ shipment: Shipment }>(`/admin/zone-rate/shipments/${id}`)

export const orderShipments = (orderId: string) =>
  sdk.client.fetch<{ shipments: Shipment[] }>(`/admin/zone-rate/orders/${orderId}/shipments`)

export const createShipment = (orderId: string) =>
  sdk.client.fetch<{ shipment: Shipment }>("/admin/zone-rate/shipments", { method: "POST", body: { order_id: orderId } })

export type StatusBody = {
  status: string
  note?: string | null
  location?: string | null
  occurred_at?: string | null
  public?: boolean
  photo_ids?: string[]
  carrier?: { name?: string | null; tracking_number?: string | null; tracking_url?: string | null }
}

export const updateStatus = (id: string, body: StatusBody) =>
  sdk.client.fetch<{ shipment: Shipment; event: ShipmentEvent }>(`/admin/zone-rate/shipments/${id}/status`, { method: "POST", body })

export const bulkStatus = (body: { ids: string[]; status: string; note?: string | null; location?: string | null }) =>
  sdk.client.fetch<{ updated: number; failed: number; results: { id: string; ok: boolean; error?: string }[] }>(
    "/admin/zone-rate/shipments/bulk-status",
    { method: "POST", body }
  )

export const updateCarrier = (id: string, carrier: { name?: string | null; tracking_number?: string | null; tracking_url?: string | null }) =>
  sdk.client.fetch<{ shipment: Shipment }>(`/admin/zone-rate/shipments/${id}`, { method: "POST", body: { carrier } })

export const uploadPhoto = (id: string, dataUrl: string) =>
  sdk.client.fetch<{ photo: { id: string } }>(`/admin/zone-rate/shipments/${id}/photos`, { method: "POST", body: { data_url: dataUrl } })

export const backendUrl = (path: string) => `${(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "")}${path}`
export const photoUrl = (id: string) => backendUrl(`/admin/zone-rate/photos/${id}`)

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export const statusLabel = (info: TrackingInfo | undefined, id: string, l: "en" | "id") =>
  info?.statuses.find((s) => s.id === id)?.label[l] ?? id

export const STATUS_COLOR: Record<string, "grey" | "blue" | "orange" | "green" | "red" | "purple"> = {
  diproses: "grey",
  dikemas: "purple",
  diserahkan_ke_kurir: "blue",
  dikirim: "blue",
  transit: "blue",
  tiba_di_kota_tujuan: "blue",
  dalam_pengantaran: "orange",
  terkirim: "green",
  gagal_kirim: "red",
  dikembalikan: "red",
  dibatalkan: "grey",
}

export const isLate = (s: Shipment, info?: TrackingInfo) =>
  !!s.estimated_delivery_at && !s.delivered_at && !info?.statuses.find((x) => x.id === s.status)?.final && new Date(s.estimated_delivery_at) < new Date()

/** Live updates (SSE) → callback; returns a closer. Polling every 30 s is the fallback in the pages. */
export function subscribeShipments(onUpdate: (u: { shipment_id: string; order_id: string; status: string }) => void): () => void {
  if (typeof EventSource === "undefined") return () => {}
  const es = new EventSource(backendUrl("/admin/zone-rate/shipments/stream"), { withCredentials: true })
  es.addEventListener("update", (e) => {
    try {
      onUpdate(JSON.parse((e as MessageEvent).data))
    } catch {
      /* ignore */
    }
  })
  return () => es.close()
}

export const shipmentQr = (id: string) => sdk.client.fetch<{ svg: string; value: string }>(`/admin/zone-rate/shipments/${id}/qr`)
