import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { Locale } from "../lib/types"
import { shipmentHub, type ShipmentUpdate } from "../lib/tracking/realtime"
import type { Actor } from "../lib/tracking/shipments"

/** The logged-in admin as recorded on timeline events */
export async function adminActor(req: AuthenticatedMedusaRequest): Promise<Actor> {
  const id = req.auth_context?.actor_id ?? null
  if (!id) return { id: null, name: null }
  try {
    const user = await req.scope.resolve(Modules.USER).retrieveUser(id)
    return { id, name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email }
  } catch {
    return { id, name: null }
  }
}

/**
 * Language of a store response: `?lang=`, then Medusa's own request locale
 * (2.22 consumes `?locale=` itself), then Accept-Language.
 */
export function requestLocale(req: MedusaRequest): Locale {
  const pick = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : "")
  for (const v of [pick(req.query?.lang), pick(req.query?.locale), pick((req as { locale?: unknown }).locale)]) {
    if (v.startsWith("id")) return "id"
    if (v.startsWith("en")) return "en"
  }
  return pick(req.headers["accept-language"]).startsWith("id") ? "id" : "en"
}

/**
 * Server-sent events: one `update` per matching shipment change, a comment
 * every 25 s to keep proxies from closing the stream. Clients reconnect on
 * their own (EventSource) and fall back to polling.
 */
export function streamUpdates(req: MedusaRequest, res: MedusaResponse, filter: (u: ShipmentUpdate) => boolean, map: (u: ShipmentUpdate) => unknown = (u) => u) {
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  shipmentHub.start(config.projectConfig.redisUrl, req.scope.resolve(ContainerRegistrationKeys.LOGGER))
  res.status(200)
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  res.setHeader("Cache-Control", "no-store, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()
  res.write("retry: 5000\n\n")
  const unsubscribe = shipmentHub.subscribe((u) => {
    if (filter(u)) res.write(`event: update\ndata: ${JSON.stringify(map(u))}\n\n`)
  })
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000)
  const close = () => {
    clearInterval(ping)
    unsubscribe()
  }
  req.on("close", close)
  // Long-lived: end after 30 minutes, the client reconnects
  setTimeout(() => {
    close()
    res.end()
  }, 30 * 60_000).unref()
}
