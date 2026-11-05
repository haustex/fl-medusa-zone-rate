# Storefront core (tracking)

The buyer's side of tracking, independent of any starter: React components, the calls to the plugin's Store API and
the texts in English and Indonesian. `examples/dtc-starter/install.mjs` copies this folder to
`src/modules/zone-rate-tracking/core/` of a DTC Starter storefront; for another React storefront copy it yourself
(plain TypeScript, no dependencies besides React).

| File | |
| --- | --- |
| `api.ts` | server-side calls: `getRateCard`, `getTracking`, `openTrackingStream` (SSE relay), `getOrderShipments`, `getPhoto`; `clientIpFrom`, `backendHeaders` |
| `labels.ts` | EN / ID texts, date formats, `normalizeInput` |
| `types.ts` | `PublicShipment`, `CustomerShipment` |
| `theme.ts` | class names (Tailwind + `@medusajs/ui-preset` tokens by default) and `mergeTheme` |
| `components/tracking-lookup.tsx` | the lookup form (plain GET form, works without JavaScript) |
| `components/tracking-view.tsx` | the live card (client): summary + timeline, SSE with 30 s polling fallback |
| `components/tracking-summary.tsx`, `tracking-timeline.tsx` | server-renderable parts, also for the order page |

The browser never calls the backend directly: `EventSource` cannot send the publishable key, so the storefront relays
`GET /store/zone-rate/track/:number` and its `/stream` through two route handlers of its own (see the example), adding
the buyer's IP with the shared `proxySecret` so the per-IP limit counts buyers.
