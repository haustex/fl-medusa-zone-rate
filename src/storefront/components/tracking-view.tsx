"use client"

import { useEffect, useRef, useState } from "react"
import { LABELS, type TrackingLocale } from "../labels"
import { mergeTheme, type TrackingTheme } from "../theme"
import type { PublicShipment } from "../types"
import { TrackingSummary } from "./tracking-summary"
import { TrackingTimeline } from "./tracking-timeline"

const POLL_MS = 30_000

/**
 * The live tracking card. Server-render it with the first lookup; it then
 * listens to `streamUrl` (SSE) and re-reads `fetchUrl` on every update, or
 * polls every 30 s when the stream is unavailable. Stops once the shipment
 * reached a final status.
 */
export function TrackingView({
  initial,
  fetchUrl,
  streamUrl,
  locale,
  timeZone,
  theme,
  placeNames,
}: {
  initial: PublicShipment
  fetchUrl: string
  streamUrl?: string
  locale: TrackingLocale
  timeZone?: string
  theme?: Partial<TrackingTheme>
  /** Display names of province/country codes (plain data: this is a client component) */
  placeNames?: Record<string, string>
}) {
  const t = LABELS[locale]
  const c = mergeTheme(theme)
  const [shipment, setShipment] = useState(initial)
  const [flash, setFlash] = useState(false)
  const last = useRef(initial.status + initial.events.length)

  useEffect(() => {
    if (shipment.final) return
    let stopped = false
    let poll: ReturnType<typeof setInterval> | null = null
    let es: EventSource | null = null

    const refresh = async () => {
      try {
        const res = await fetch(fetchUrl, { cache: "no-store" })
        if (!res.ok) return
        const next = (await res.json()).shipment as PublicShipment
        if (stopped || !next) return
        const sig = next.status + next.events.length
        if (sig !== last.current) {
          last.current = sig
          setShipment(next)
          setFlash(true)
          setTimeout(() => setFlash(false), 4000)
        }
      } catch {
        /* next tick */
      }
    }
    const startPolling = () => {
      if (!poll) poll = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS)
    }

    if (streamUrl && typeof EventSource !== "undefined") {
      es = new EventSource(streamUrl)
      es.addEventListener("update", () => refresh())
      // Reconnects on its own; poll meanwhile so nothing is missed
      es.onerror = () => startPolling()
      es.onopen = () => {
        if (poll) clearInterval(poll)
        poll = null
      }
    } else {
      startPolling()
    }
    const onVisible = () => document.visibilityState === "visible" && refresh()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      es?.close()
      if (poll) clearInterval(poll)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [fetchUrl, streamUrl, shipment.final])

  return (
    <div className="flex flex-col gap-y-6" data-testid="tracking-view">
      <section className={c.card} aria-labelledby="tracking-status-heading">
        <h2 id="tracking-status-heading" className="sr-only">
          {t.status}
        </h2>
        <TrackingSummary
          shipment={shipment}
          locale={locale}
          timeZone={timeZone}
          theme={theme}
          placeNames={placeNames}
        />
        {!shipment.final && (
          <span className={c.live} role="status" data-testid="tracking-live">
            <span aria-hidden="true" className={c.liveDot} />
            {flash ? t.updated : t.live}
          </span>
        )}
      </section>
      <section className={c.card} aria-labelledby="tracking-history-heading">
        <h2 id="tracking-history-heading" className={c.heading}>
          {t.history}
        </h2>
        <TrackingTimeline events={shipment.events} locale={locale} timeZone={timeZone} theme={theme} />
      </section>
    </div>
  )
}
