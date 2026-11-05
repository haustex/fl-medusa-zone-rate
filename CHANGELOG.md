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

### Admin

- "Shipping rates" page: rates, zones and exchange rate; incomplete variants report with CSV export; rejection log.
  English and Indonesian; optional "by Haus Kayu" credit.
