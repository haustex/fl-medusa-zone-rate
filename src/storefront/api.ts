import type { TrackingLocale } from "./labels"
import type { CustomerShipment, PublicShipment, RateCard } from "./types"

/** How the storefront's server reaches the plugin's Store API */
export type BackendConfig = {
  baseUrl: string
  publishableKey: string
  /** "Bearer <customer JWT>" for the customer's own order shipments */
  authorization?: string | null
  /** The buyer's IP, sent with `proxySecret` so the per-IP lookup limit counts buyers */
  clientIp?: string | null
  /** = the plugin's tracking.trustedProxySecret */
  proxySecret?: string | null
}

export const CLIENT_IP_HEADER = "x-zr-client-ip"
export const PROXY_SECRET_HEADER = "x-zr-proxy-secret"

type HeaderSource = { get(name: string): string | null }

/** X-Real-IP (set by the reverse proxy), else the first X-Forwarded-For entry */
export function clientIpFrom(headers: HeaderSource): string | null {
  const real = headers.get("x-real-ip")?.trim()
  if (real) return real
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
}

export function backendHeaders(config: BackendConfig): Record<string, string> {
  const h: Record<string, string> = { "x-publishable-api-key": config.publishableKey }
  if (config.authorization) h.authorization = config.authorization
  if (config.proxySecret && config.clientIp) {
    h[CLIENT_IP_HEADER] = config.clientIp
    h[PROXY_SECRET_HEADER] = config.proxySecret
  }
  return h
}

const url = (config: BackendConfig, path: string) => `${config.baseUrl.replace(/\/+$/, "")}${path}`

export type LookupResult =
  | { ok: true; shipment: PublicShipment }
  | { ok: false; reason: "not_found" | "rate_limited" | "error" }

export async function getTracking(config: BackendConfig, number: string, locale: TrackingLocale): Promise<LookupResult> {
  const res = await fetch(url(config, `/store/zone-rate/track/${encodeURIComponent(number)}?lang=${locale}`), {
    headers: { ...backendHeaders(config), "accept-language": locale },
    cache: "no-store",
  })
  if (res.status === 404) return { ok: false, reason: "not_found" }
  if (res.status === 429) return { ok: false, reason: "rate_limited" }
  if (!res.ok) return { ok: false, reason: "error" }
  return { ok: true, shipment: (await res.json()).shipment }
}

/** Opens the SSE stream of one tracking number; return its Response from a route handler to relay it */
export function openTrackingStream(config: BackendConfig, number: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url(config, `/store/zone-rate/track/${encodeURIComponent(number)}/stream`), {
    headers: { ...backendHeaders(config), accept: "text/event-stream" },
    cache: "no-store",
    signal,
  })
}

export async function getOrderShipments(config: BackendConfig, orderId: string, locale: TrackingLocale): Promise<CustomerShipment[]> {
  const res = await fetch(url(config, `/store/zone-rate/orders/${encodeURIComponent(orderId)}/shipments?lang=${locale}`), {
    headers: { ...backendHeaders(config), "accept-language": locale },
    cache: "no-store",
  })
  if (!res.ok) return []
  return (await res.json()).shipments ?? []
}

/** A proof photo of the customer's own order (relay it from a route handler) */
export function getPhoto(config: BackendConfig, photoId: string): Promise<Response> {
  return fetch(url(config, `/store/zone-rate/photos/${encodeURIComponent(photoId)}`), { headers: backendHeaders(config), cache: "no-store" })
}

/** Response headers for a relayed SSE stream */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
}

/** The public rate card (services, zones, per-kg rates in `currency`, estimates) for a shipping-info page */
export async function getRateCard(
  config: BackendConfig,
  currency: string,
  locale: TrackingLocale,
  init?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }
): Promise<RateCard | null> {
  const res = await fetch(url(config, `/store/zone-rate/services?currency=${encodeURIComponent(currency)}&lang=${locale}`), {
    headers: { "x-publishable-api-key": config.publishableKey, "accept-language": locale },
    ...init,
  }).catch(() => null)
  return res?.ok ? res.json() : null
}
