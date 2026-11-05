# Tracking pages for the Medusa DTC Starter

```bash
node node_modules/medusa-fulfillment-zone-rate/examples/dtc-starter/install.mjs apps/storefront
```

Adds:

| Path | |
| --- | --- |
| `src/modules/zone-rate-tracking/core/` | the storefront core (`src/storefront` of the package) |
| `src/modules/zone-rate-tracking/config.ts` | paths, language, theme, province names — yours to edit, never overwritten |
| `src/modules/zone-rate-tracking/tracking-page.tsx` | lookup form + live card |
| `src/modules/zone-rate-tracking/order-shipments.tsx` | shipments with timeline, notes and photos for the customer's order page |
| `src/app/[countryCode]/(main)/track/[[...number]]/page.tsx` | `/{country}/track` and `/{country}/track/{number}` |
| `src/app/api/zone-rate/track/[number]/route.ts`, `…/stream/route.ts` | relays of the lookup and its SSE stream |
| `src/app/api/zone-rate/photos/[id]/route.ts` | proof photos of the customer's own order |

Set `ZONE_RATE_PROXY_SECRET` (storefront server env) to the plugin's `tracking.trustedProxySecret`, so the per-IP
lookup limit counts buyers rather than the storefront server.

On the order page (`src/modules/order/templates/order-details-template.tsx` in the starter):

```tsx
import { OrderShipments } from "@modules/zone-rate-tracking/order-shipments"
// …
<OrderShipments orderId={order.id} countryCode={countryCode} />
```
