# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | yes |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately:

- through GitHub: **Security → Report a vulnerability** on
  [haustex/fl-medusa-zone-rate](https://github.com/haustex/fl-medusa-zone-rate/security), or
- by e-mail to [dev@hauskayu.com](mailto:dev@hauskayu.com), subject "Security: Zone Rate & Tracking".

Include the plugin and Medusa versions, what an attacker can do, and steps to reproduce. We will confirm that we
received the report, keep you updated while we fix it, and credit you in the release notes if you wish.


## Scope

Of particular interest:

- a cart priced at 0 or below the configured rate (bypassing a refusal, rounding, currency conversion);
- reading the rejection log or the incomplete-variants report without an Admin login;
- CSV/formula injection through product or variant titles in the export;
- (tracking, once released) reading another buyer's shipment details or guessing tracking numbers.

## Operating the plugin safely

- Keep the config file in your repository and review rate changes like code: the provider prices carts only from it.
- Update `exchange_rates.*.rate` and `updated_at` together; the Admin shows the date so stale rates are visible.
