import { trackingBackend } from "@lib/zone-rate-tracking/backend"
import { getOrderShipments } from "@modules/zone-rate-tracking/core/api"
import { TrackingSummary } from "@modules/zone-rate-tracking/core/components/tracking-summary"
import { TrackingTimeline } from "@modules/zone-rate-tracking/core/components/tracking-timeline"
import { LABELS } from "@modules/zone-rate-tracking/core/labels"
import { mergeTheme } from "@modules/zone-rate-tracking/core/theme"
import { trackingConfig } from "./config"

/**
 * For the customer's order page (server component): every shipment of the
 * order with the full public timeline, notes and proof photos. Renders
 * nothing for guests, other customers' orders, or orders without shipments.
 *
 *   <OrderShipments orderId={order.id} countryCode={countryCode} />
 */
export async function OrderShipments({ orderId, countryCode }: { orderId: string; countryCode: string }) {
  const locale = trackingConfig.locale(countryCode)
  const shipments = await getOrderShipments(await trackingBackend({ withCustomer: true }), orderId, locale).catch(() => [])
  if (!shipments.length) return null
  const t = LABELS[locale]
  const c = mergeTheme(trackingConfig.theme)
  return (
    <section className="flex flex-col gap-y-4" data-testid="order-shipments">
      <h2 className={c.heading}>{t.history}</h2>
      {shipments.map((s) => (
        <div key={s.tracking_number} className={c.card}>
          <TrackingSummary shipment={s} locale={locale} timeZone={trackingConfig.timeZone} theme={trackingConfig.theme} provinceName={trackingConfig.provinceName} />
          <TrackingTimeline
            events={s.events}
            locale={locale}
            timeZone={trackingConfig.timeZone}
            theme={trackingConfig.theme}
            photoUrl={(id) => `/api/zone-rate/photos/${encodeURIComponent(id)}`}
          />
        </div>
      ))}
    </section>
  )
}
