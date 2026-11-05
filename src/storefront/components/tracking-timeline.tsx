import { formatDateTime, LABELS, type TrackingLocale } from "../labels"
import { mergeTheme, type TrackingTheme } from "../theme"
import type { TrackingEvent } from "../types"

/** Newest first; `photoUrl` only for the customer view */
export function TrackingTimeline({
  events,
  locale,
  timeZone,
  theme,
  photoUrl,
}: {
  events: TrackingEvent[]
  locale: TrackingLocale
  timeZone?: string
  theme?: Partial<TrackingTheme>
  photoUrl?: (id: string) => string
}) {
  const t = LABELS[locale]
  const c = mergeTheme(theme)
  if (!events.length) return <p className={c.small}>{t.noEvents}</p>
  return (
    <ol className={c.timeline} data-testid="tracking-timeline">
      {events.map((e, i) => (
        <li key={e.id ?? `${e.status}-${e.occurred_at}`} className={c.event}>
          <span aria-hidden="true" className={i === 0 ? c.dotCurrent : c.dot} />
          {i < events.length - 1 && <span aria-hidden="true" className={c.line} />}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={c.eventTitle}>{e.label}</span>
            <span className={c.eventMeta}>
              <time dateTime={e.occurred_at}>{formatDateTime(e.occurred_at, locale, timeZone)}</time>
              {e.location ? ` · ${e.location}` : ""}
            </span>
            {e.note && <span className={c.small}>{e.note}</span>}
            {photoUrl && !!e.photo_ids?.length && (
              <span className={c.photos}>
                {e.photo_ids.map((p) => (
                  <a key={p} href={photoUrl(p)} target="_blank" rel="noreferrer">
                    <img src={photoUrl(p)} alt={t.photos} loading="lazy" className={c.photo} />
                  </a>
                ))}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
