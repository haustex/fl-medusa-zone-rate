import "server-only"
import { getAuthHeaders } from "@lib/data/cookies"
import { type BackendConfig, clientIpFrom } from "@modules/zone-rate-tracking/core/api"
import { headers } from "next/headers"

/**
 * How this storefront's server reaches the plugin: the starter's backend URL
 * and publishable key, the customer's JWT cookie, and the buyer's IP with
 * ZONE_RATE_PROXY_SECRET (= the plugin's `tracking.trustedProxySecret`).
 */
export async function trackingBackend(opts: { withCustomer?: boolean } = {}): Promise<BackendConfig> {
  const auth = opts.withCustomer ? ((await getAuthHeaders()) as { authorization?: string }) : {}
  return {
    baseUrl: process.env.MEDUSA_BACKEND_URL_INTERNAL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
    authorization: auth.authorization ?? null,
    clientIp: clientIpFrom(await headers()),
    proxySecret: process.env.ZONE_RATE_PROXY_SECRET ?? null,
  }
}
