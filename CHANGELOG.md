# Changelog

All notable changes to `medusa-fulfillment-zone-rate`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.2] - 2026-11-07

### Added

- Plugin option `brand.logoUrl`: an absolute http(s) URL of the store's logo, printed on the A6 label (sender box)
  and the packing slip header in place of the store name. Default none: the store name stays as text, so nothing
  changes for existing installs. Other schemes and relative paths are ignored.

## [0.3.1] - 2026-11-05

Same code as 0.3.0, published from GitHub Actions with npm provenance. 0.3.0 was published by hand (no provenance)
and is deprecated.

### Changed

- E2E: waits for Postgres over TCP before the first psql (a fresh container's init server restarts); container
  name from `ZR_PG_CONTAINER`. CI starts Postgres with a health check. Test tooling only.

## [0.3.0] - 2026-11-05

First public release on npm (0.1.0–0.2.1 were internal builds). Works with Medusa `^2.19.0`, tested on 2.19.0
and 2.22.2. Published by hand without provenance; use 0.3.1.

### Added

- Per-line package: `line_item.metadata.zone_rate_package` (`weight`, `length`, `width`, `height` per unit) prices
  lines without a variant, such as custom items on a draft order, and overrides the variant's values for that line.
  The tracking snapshot uses the same values. Lines without it behave exactly as before.

## [0.2.1]

### Fixed

- Automatic shipment creation (`tracking.autoCreate`) could issue a **second tracking number** when `order.placed` /
  `payment.captured` arrived again (replayed or duplicate event) after the order's shipment had been canceled, and
  for canceled orders. It now creates nothing for orders that are canceled, archived or still a draft, or that have
  had any shipment before (canceled ones included); duplicate and replayed events are idempotent.
- Admin "Create shipment" is refused for canceled, archived and draft orders. It still returns the open shipment,
  and an admin can still re-issue one after a canceled shipment on an open order.

## [0.2.0]

### Added

- Option `tracking.requirePaidBeforeShipping` (default `false`): refuses the shipped statuses (`medusa: "shipped"`)
  while the order has an outstanding amount (total minus captured payments), with a message naming the amount.
  Meant for deposit + balance billing. With the option off nothing changes.

## [0.1.0]

### Calculated rates

- Fulfillment provider `zone-rate` with calculated prices; one fulfillment option per configured service.
- Chargeable weight = max(actual, volumetric), rounded up to a whole kg, at least 1 kg (or `minimum_kg`), integer
  arithmetic only. Divisor per service (default 6000), weight/dimension units, product fallback.
- Zones by Indonesian province (tolerant matcher for the 38 provinces: ISO codes, names, abbreviations, old
  spellings) or by country.
- Fixed exchange rates for carts in another currency, rounded up to a whole unit; optional `minimum_charge`.
- Refusals instead of 0 (unknown destination, missing weight or dimension, no exchange rate) with English/Indonesian
  messages, logged in `zone_rate_rejection`.
- Config validated at startup.

### Tracking (backend)

- Shipment records (module `zoneRate`, read-only links to order and fulfillment) with an append-only timeline:
  status, note, location, time, admin, shown-to-buyer, proof photos (stored in the database).
- Tracking numbers `HK-YYMMDD-XXXXXC` (store time zone, 5 random Crockford base32 symbols + Luhn mod 32 check
  symbol, unique index); third-party carrier name/number/link alongside.
- Status machine (`diproses` → `dikemas` → `diserahkan_ke_kurir`/`dikirim` → `transit` → `tiba_di_kota_tujuan` →
  `dalam_pengantaran` → `terkirim`, plus `gagal_kirim`, `dikembalikan`, `dibatalkan`), extendable via
  `tracking.statuses`; invalid transitions refused.
- Medusa in step: shipped statuses create the fulfillment (when missing) and the Medusa shipment with our tracking
  number as label; `terkirim` marks it delivered; `dibatalkan` cancels an unshipped fulfillment.
- Events `shipment.created` and `shipment.status_updated`; shipments created automatically on `payment.captured`
  (or `order.placed`, or never) for zone-rate orders.
- Live updates over SSE (Admin stream, per tracking number for buyers) through a Redis pub/sub channel when
  Redis is configured.
- Buyer e-mails for public statuses through the Notification Module (en/id templates, replaceable, idempotency key
  per event); quietly skipped without a provider.
- Store API: public lookup (status, city, times only; rate limited per IP; 404 on a bad check symbol), SSE stream,
  the customer's own order shipments and photos. Admin API: list/search/filter, summary (per status, late, shipped
  today), detail, status update, bulk update, carrier details, photo upload.

### Storefront

- Tracking core (`src/storefront`): lookup form, live tracking card (SSE + polling), timeline, order shipments;
  `getRateCard` for shipping-info pages (`GET /store/zone-rate/services`, per-kg rates converted at the fixed rate).
- DTC Starter installer (`examples/dtc-starter/install.mjs`): pages, relays, `config.ts` kept on re-install.

### Admin

- "Shipping rates" page: rates, zones and exchange rate; incomplete variants report with CSV export; rejection log.
  English and Indonesian; optional "by Haus Kayu" credit.

[0.3.1]: https://github.com/haustex/fl-medusa-zone-rate/releases/tag/v0.3.1
[0.3.0]: https://github.com/haustex/fl-medusa-zone-rate/releases/tag/v0.3.0
