# CLAUDE.md — Zone Rate & Tracking by Haus Kayu (medusa-fulfillment-zone-rate)

## ⚠️ Server rules (read before doing anything)

This host also runs the **hauskayu.com production store**.

- **Never** send requests to ports `9000`, `8000`, `80`, `443`, `5432`, `6379` or any `*.hauskayu.com` domain from tests.
- **Never** touch the `hauskayu-*` containers.
- Test **only** on ports `9500+` and the `zr-spike-*` containers (Postgres `127.0.0.1:55434`, Redis `127.0.0.1:56381`).
- Every medusa/db command goes **through `scripts/guard.mjs`**.
- **Never commit** secrets or `.env` files. Do not publish to npm or push to GitHub until Anto says OK.

## Technical decisions

- Pure calculator in `src/lib` (no Medusa imports except `MedusaError`), unit-tested; the provider only maps the cart
  context to `QuoteInput` and throws `MedusaError.NOT_ALLOWED` with the buyer-facing message on a refusal.
- Integer math: weights → milligrams, dimensions → 10-µm steps, BigInt; currency conversion scaled ×10⁶, rounded up.
- Medusa 2.19–2.22 `calculatePrice` context has `items.variant.{weight,length,width,height}` and
  `items.product.weight` only, so product dimensions (fallback) are read from `product` through `__pg_connection__`
  in the Fulfillment Module's container.
- `GET /store/shipping-options` does not price calculated options; the storefront calls
  `POST /store/shipping-options/:id/calculate` per option, so a refusal only fails that call. Adding a shipping
  method recalculates and refuses too.
- Rejections are written with raw SQL into `zone_rate_rejection` (module `zoneRate`) through the same connection;
  repeats for the same cart + signature bump `count`. Logging never throws.
- The provider's options ARE the rate config; Admin routes find it in `configModule.modules` (fulfillment providers
  whose `resolve` points at this package). Plugin options hold only `showCredit`.
- Tracking orchestration lives in `src/lib/tracking/shipments.ts` (not a workflow): Locking Module per
  shipment/order, then Medusa's own workflows (`createOrderFulfillmentWorkflow`, `createOrderShipmentWorkflow`,
  `markOrderFulfillmentAsDeliveredWorkflow`, `cancelOrderFulfillmentWorkflow`) run from there.
- Order query: `items.quantity` is only filled when `items.detail.quantity` is requested too; quantities come back as
  BigNumber, convert with `MathBN`.
- In server+worker mode subscribers run only in the worker, so the SSE hub is fed directly by the process that
  records the status (and Redis pub/sub for the others), not by a subscriber.
- `medusa exec` rejects `--flags` for scripts; use plain words.
