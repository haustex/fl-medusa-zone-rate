import { trackingBackend } from "@lib/zone-rate-tracking/backend"
import { getTracking } from "@modules/zone-rate-tracking/core/api"
import { TrackingLookup } from "@modules/zone-rate-tracking/core/components/tracking-lookup"
import { TrackingView } from "@modules/zone-rate-tracking/core/components/tracking-view"
import { LABELS, looksLikeTrackingNumber, normalizeInput } from "@modules/zone-rate-tracking/core/labels"
import { mergeTheme } from "@modules/zone-rate-tracking/core/theme"
import { redirect } from "next/navigation"
import { trackingConfig } from "./config"

/**
 * /{path}            lookup form
 * /{path}?number=…   (form submit) → redirect to /{path}/{NUMBER}
 * /{path}/{number}   live tracking card
 */
/** Functions cannot cross into client components: resolve the one province name here */
const placeNames = (province: string | null): Record<string, string> | undefined =>
  province && trackingConfig.provinceName ? { [province]: trackingConfig.provinceName(province) } : undefined

export async function TrackingPage({ countryCode, number, query }: { countryCode: string; number?: string; query?: string }) {
  const locale = trackingConfig.locale(countryCode)
  const base = trackingConfig.path(countryCode)
  const t = LABELS[locale]
  const c = mergeTheme(trackingConfig.theme)

  if (!number && query) {
    if (looksLikeTrackingNumber(query)) redirect(`${base}/${encodeURIComponent(normalizeInput(query))}`)
  }
  const raw = number ? decodeURIComponent(number) : query
  let error: string | null = null
  let view = null
  if (number) {
    const result = await getTracking(await trackingBackend(), raw!, locale)
    if (result.ok) {
      const enc = encodeURIComponent(result.shipment.tracking_number)
      view = (
        <TrackingView
          initial={result.shipment}
          fetchUrl={`/api/zone-rate/track/${enc}?locale=${locale}`}
          streamUrl={`/api/zone-rate/track/${enc}/stream`}
          locale={locale}
          timeZone={trackingConfig.timeZone}
          theme={trackingConfig.theme}
          placeNames={placeNames(result.shipment.destination.province)}
        />
      )
    } else {
      error = result.reason === "rate_limited" ? t.tooMany : `${t.notFound}. ${t.notFoundHint}`
    }
  } else if (query) {
    error = t.invalid
  }

  return (
    <div className={c.page} data-testid="tracking-page">
      <div className={c.inner}>
        <div className="flex flex-col gap-y-2">
          <h1 className={c.title}>{t.title}</h1>
          <p className={c.subtle}>{t.intro}</p>
        </div>
        <TrackingLookup action={base} locale={locale} defaultValue={raw ?? ""} error={error} theme={trackingConfig.theme} />
        {view}
      </div>
    </div>
  )
}
