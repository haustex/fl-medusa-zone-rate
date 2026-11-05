import fs from "node:fs"
import path from "node:path"
import type { ConfigModule, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { StatusDefinition } from "./tracking/statuses"
import type { ZoneRateConfig } from "./types"

export const PACKAGE_NAME = "medusa-fulfillment-zone-rate"

/** Options of the plugin entry (`plugins: [{ resolve, options }]`), separate from the provider's rate config */
export type ZoneRatePluginOptions = {
  /** Show the small "by Haus Kayu" credit under the plugin's Admin pages. Default true. */
  showCredit?: boolean
  tracking?: TrackingOptions
}

export type TrackingOptions = {
  /** Tracking number prefix, 1–4 letters. Default "HK". */
  prefix?: string
  /** Time zone of the date in tracking numbers and of "shipped today". Default "Asia/Jakarta". */
  timeZone?: string
  /** Relabel, add or rewire statuses (see src/lib/tracking/statuses.ts) */
  statuses?: Partial<StatusDefinition>[]
  /**
   * Create the shipment record automatically: when the order's payment is
   * captured (default), when the order is placed, or never (Admin only).
   */
  autoCreate?: "payment.captured" | "order.placed" | false
  /**
   * Refuse the shipped statuses (`medusa: "shipped"`, e.g. `dikirim`) while the
   * order still has an outstanding amount (total minus captured payments), for
   * stores that bill in parts (deposit + balance). Default false: no check.
   * Note: authorized-but-not-captured payments count as outstanding.
   */
  requirePaidBeforeShipping?: boolean
  /** Public tracking lookups one IP may make per minute. Default 30. */
  lookupsPerIpPerMinute?: number
  /**
   * Secret the storefront sends in `x-zr-proxy-secret` with the buyer's IP in
   * `x-zr-client-ip`, so the per-IP limit counts buyers, not the storefront
   * server. Default: env ZONE_RATE_PROXY_SECRET; unset trusts no header.
   */
  trustedProxySecret?: string
  /** Sender block of the A6 label. Default: the store name and the first stock location's address. */
  label?: { senderName?: string; senderAddress?: string[]; senderPhone?: string }
  notifications?: {
    /** E-mail the buyer on every status shown to the buyer. Default true (needs a Notification Module provider). */
    enabled?: boolean
    channel?: string
    /** Buyer language: "auto" (Indonesian for Indonesian addresses), "en" or "id". Default "auto". */
    locale?: "auto" | "en" | "id"
    /**
     * Tracking page link with {tracking_number}, per language, e.g.
     * { id: "https://shop.id/lacak/{tracking_number}", en: "https://shop.id/us/track/{tracking_number}" }
     */
    trackingUrl?: string | { en?: string; id?: string }
    /** Store name in the e-mails. Default "our store". */
    storeName?: string
  }
}

type Entry = string | { resolve?: unknown; options?: unknown; providers?: unknown }

function configModule(container: MedusaContainer): ConfigModule {
  return container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
}

function packageNameAt(dir: string): string | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name ?? null
  } catch {
    return null
  }
}

/** A resolve string that points at this package: its name, a sub-path of it, or a local path to it */
export function isThisPackage(resolve: string): boolean {
  const r = resolve.replace(/\/+$/, "")
  if (r === PACKAGE_NAME || r.startsWith(`${PACKAGE_NAME}/`) || r.includes(`/${PACKAGE_NAME}`)) return true
  if (r.startsWith(".") || path.isAbsolute(r)) {
    // "./plugins/zone-rate" or ".../providers/zone-rate" inside a checkout of this package
    for (let dir = path.resolve(r), i = 0; i < 6; i++, dir = path.dirname(dir)) {
      if (packageNameAt(dir) === PACKAGE_NAME) return true
    }
  }
  return false
}

export function getPluginOptions(container: MedusaContainer): ZoneRatePluginOptions {
  for (const p of (configModule(container).plugins ?? []) as Entry[]) {
    const resolve = typeof p === "string" ? p : p.resolve
    if (typeof resolve === "string" && isThisPackage(resolve)) {
      return typeof p === "string" ? {} : ((p.options as ZoneRatePluginOptions) ?? {})
    }
  }
  return {}
}

/**
 * The rate config, as passed to the zone-rate provider of the Fulfillment
 * Module (the provider is the only consumer that prices carts; the Admin reads
 * the same object to show rates and the exchange rate).
 */
export function getProviderConfig(container: MedusaContainer): ZoneRateConfig | null {
  const modules = configModule(container).modules ?? {}
  const entries: Entry[] = Array.isArray(modules) ? modules : Object.values(modules as Record<string, Entry>)
  for (const m of entries) {
    if (!m || typeof m !== "object") continue
    const providers = ((m.options as { providers?: unknown })?.providers ?? m.providers) as Entry[] | undefined
    if (!Array.isArray(providers)) continue
    for (const p of providers) {
      if (p && typeof p === "object" && typeof p.resolve === "string" && isThisPackage(p.resolve)) {
        return (p.options as ZoneRateConfig) ?? null
      }
    }
  }
  return null
}

export function getTrackingOptions(container: MedusaContainer) {
  const t = getPluginOptions(container).tracking ?? {}
  return {
    prefix: t.prefix ?? "HK",
    timeZone: t.timeZone ?? "Asia/Jakarta",
    statuses: t.statuses ?? [],
    autoCreate: t.autoCreate === undefined ? ("payment.captured" as const) : t.autoCreate,
    requirePaidBeforeShipping: t.requirePaidBeforeShipping === true,
    lookupsPerIpPerMinute: t.lookupsPerIpPerMinute ?? 30,
    trustedProxySecret: t.trustedProxySecret ?? process.env.ZONE_RATE_PROXY_SECRET ?? null,
    notifications: {
      enabled: t.notifications?.enabled !== false,
      channel: t.notifications?.channel ?? "email",
      locale: t.notifications?.locale ?? ("auto" as const),
      trackingUrl: t.notifications?.trackingUrl ?? null,
      storeName: t.notifications?.storeName ?? null,
    },
  }
}
