import { authenticate, defineMiddlewares, validateAndTransformBody, type MedusaNextFunction, type MedusaRequest, type MedusaResponse } from "@medusajs/framework/http"
import { getTrackingOptions } from "../lib/plugin-options"
import { clientIp } from "../lib/tracking/client-ip"
import { RateLimiter } from "../lib/tracking/rate-limit"
import {
  PostAdminBulkStatus,
  PostAdminCreateShipment,
  PostAdminShipmentPhoto,
  PostAdminShipmentStatus,
  PostAdminUpdateShipment,
} from "./validators"

let limiter: RateLimiter | null = null
/** Per-IP budget of the public tracking lookups (in memory, per process) */
function lookupRateLimit(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const opts = getTrackingOptions(req.scope)
  limiter ??= new RateLimiter(opts.lookupsPerIpPerMinute, 60_000)
  const result = limiter.hit(clientIp(req as never, opts.trustedProxySecret))
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds))
    res.status(429).json({ type: "too_many_requests", message: "Too many tracking lookups, try again in a minute." })
    return
  }
  next()
}

const customer = authenticate("customer", ["session", "bearer"])

export default defineMiddlewares({
  routes: [
    { matcher: "/admin/zone-rate/shipments", method: "POST", middlewares: [validateAndTransformBody(PostAdminCreateShipment)] },
    { matcher: "/admin/zone-rate/shipments/bulk-status", method: "POST", middlewares: [validateAndTransformBody(PostAdminBulkStatus)] },
    { matcher: "/admin/zone-rate/shipments/:id", method: "POST", middlewares: [validateAndTransformBody(PostAdminUpdateShipment)] },
    { matcher: "/admin/zone-rate/shipments/:id/status", method: "POST", middlewares: [validateAndTransformBody(PostAdminShipmentStatus)] },
    {
      matcher: "/admin/zone-rate/shipments/:id/photos",
      method: "POST",
      bodyParser: { sizeLimit: "15mb" },
      middlewares: [validateAndTransformBody(PostAdminShipmentPhoto)],
    },
    { matcher: "/store/zone-rate/track/:number", method: "GET", middlewares: [lookupRateLimit] },
    { matcher: "/store/zone-rate/track/:number/stream", method: "GET", middlewares: [lookupRateLimit] },
    { matcher: "/store/zone-rate/orders/:id/shipments", method: "GET", middlewares: [customer] },
    { matcher: "/store/zone-rate/photos/:id", method: "GET", middlewares: [customer] },
  ],
})
