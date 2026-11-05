import { fill, formatDate, LABELS, type TrackingLocale } from "../labels"
import { mergeTheme, type TrackingTheme } from "../theme"
import type { PublicShipment } from "../types"

/** Number, current status and the key dates; `province` names a province code if you have a lookup */
export function TrackingSummary({
  shipment,
  locale,
  timeZone,
  theme,
  provinceName,
  countryName,
  placeNames,
}: {
  shipment: Pick<PublicShipment, "tracking_number" | "status_label" | "final" | "estimate" | "shipped_at" | "estimated_delivery_at" | "delivered_at" | "carrier"> & {
    destination: { city?: string | null; province?: string | null; country_code?: string | null } | null
  }
  locale: TrackingLocale
  timeZone?: string
  theme?: Partial<TrackingTheme>
  provinceName?: (code: string) => string
  countryName?: (code: string) => string
  /** Alternative to the functions when rendered from a client component */
  placeNames?: Record<string, string>
}) {
  const t = LABELS[locale]
  const c = mergeTheme(theme)
  const d = shipment.destination ?? {}
  const name = (code: string, fn?: (c: string) => string) => fn?.(code) ?? placeNames?.[code] ?? null
  const place = [
    d.city,
    d.province ? name(d.province, provinceName) ?? d.province : null,
    d.country_code ? name(d.country_code, countryName) ?? d.country_code.toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(", ")
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-1">
        <span className={c.number} data-testid="tracking-number">{shipment.tracking_number}</span>
        {/* statusFinal = delivered; other final statuses (canceled, returned) keep the plain style */}
        <span className={shipment.delivered_at ? c.statusFinal : c.status} data-testid="tracking-status" aria-live="polite">
          {shipment.status_label}
        </span>
      </div>
      <dl className={c.facts}>
        {place && (
          <div className={c.fact}>
            <dt className={c.factLabel}>{t.destination}</dt>
            <dd className={c.factValue}>{place}</dd>
          </div>
        )}
        {shipment.shipped_at && (
          <div className={c.fact}>
            <dt className={c.factLabel}>{t.shippedAt}</dt>
            <dd className={c.factValue}>{formatDate(shipment.shipped_at, locale, timeZone)}</dd>
          </div>
        )}
        {shipment.delivered_at ? (
          <div className={c.fact}>
            <dt className={c.factLabel}>{t.deliveredAt}</dt>
            <dd className={c.factValue}>{formatDate(shipment.delivered_at, locale, timeZone)}</dd>
          </div>
        ) : shipment.final ? null : shipment.estimated_delivery_at ? (
          <div className={c.fact}>
            <dt className={c.factLabel}>{t.expected}</dt>
            <dd className={c.factValue}>{formatDate(shipment.estimated_delivery_at, locale, timeZone)}</dd>
          </div>
        ) : shipment.estimate ? (
          <div className={c.fact}>
            <dt className={c.factLabel}>{t.expected}</dt>
            <dd className={c.factValue}>{fill(t.estimate[shipment.estimate.unit], shipment.estimate)}</dd>
          </div>
        ) : null}
        {shipment.carrier && (
          <div className={c.fact}>
            <dt className={c.factLabel}>{t.carrier}</dt>
            <dd className={c.factValue}>
              {shipment.carrier.name} {shipment.carrier.tracking_number && <span className={c.mono}>{shipment.carrier.tracking_number}</span>}
              {shipment.carrier.tracking_url && (
                <>
                  {" · "}
                  <a href={shipment.carrier.tracking_url} target="_blank" rel="noreferrer noopener" className={c.link}>
                    {t.carrierLink}
                  </a>
                </>
              )}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
