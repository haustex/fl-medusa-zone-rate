# Changelog

All notable changes to `medusa-fulfillment-zone-rate`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

### Admin

- "Shipping rates" page: rates, zones and exchange rate; incomplete variants report with CSV export; rejection log.
  English and Indonesian; optional "by Haus Kayu" credit.
