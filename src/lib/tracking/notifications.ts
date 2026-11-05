import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { Locale } from "../types"
import { getPluginOptions, getTrackingOptions } from "../plugin-options"
import { buyerLocale, statusLabel, statusMachine, trackingUrl, ZONE_RATE_MODULE, type ShipmentEventRecord, type ShipmentRecord } from "./shipments"

export type EmailTemplate = { subject: string; text: string; html?: string }

/** Placeholders: {store_name} {status} {tracking_number} {tracking_url} {order_display_id} {location} {note} {date} */
export const DEFAULT_TEMPLATES: Record<Locale, EmailTemplate> = {
  id: {
    subject: "Pesanan #{order_display_id}: {status}",
    text: [
      "Halo,",
      "",
      "Status pengiriman pesanan #{order_display_id} dari {store_name}: {status}.",
      "{location_line}",
      "{note_line}",
      "Nomor resi: {tracking_number}",
      "{tracking_line}",
      "",
      "Terima kasih,",
      "{store_name}",
    ].join("\n"),
  },
  en: {
    subject: "Order #{order_display_id}: {status}",
    text: [
      "Hello,",
      "",
      "The shipment of your {store_name} order #{order_display_id} is now: {status}.",
      "{location_line}",
      "{note_line}",
      "Tracking number: {tracking_number}",
      "{tracking_line}",
      "",
      "Thank you,",
      "{store_name}",
    ].join("\n"),
  },
}

const LINES: Record<Locale, { location: string; note: string; track: string }> = {
  id: { location: "Lokasi: {location}", note: "Catatan: {note}", track: "Lacak pengiriman: {tracking_url}" },
  en: { location: "Location: {location}", note: "Note: {note}", track: "Track your shipment: {tracking_url}" },
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export function renderShipmentEmail(
  locale: Locale,
  vars: Record<string, string | null | undefined>,
  override?: Partial<EmailTemplate>
): EmailTemplate {
  const base = { ...DEFAULT_TEMPLATES[locale], ...override }
  const lines = LINES[locale]
  const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "")
  const plain: Record<string, string> = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v ?? ""]))
  plain.location_line = vars.location ? fill(lines.location, plain) : ""
  plain.note_line = vars.note ? fill(lines.note, plain) : ""
  plain.tracking_line = vars.tracking_url ? fill(lines.track, plain) : ""
  const text = fill(base.text, plain).replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "") + "\n"
  const subject = fill(base.subject, plain).replace(/[\r\n]+/g, " ")
  const html =
    base.html !== undefined
      ? fill(base.html, Object.fromEntries(Object.entries(plain).map(([k, v]) => [k, escapeHtml(v)])))
      : `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${text
          .split("\n")
          .map((l) => (l ? escapeHtml(l).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>') : "&nbsp;"))
          .join("<br>")}</div>`
  return { subject, text, html }
}

/**
 * E-mails the buyer about a public status event, once (idempotency key per
 * event and address). Quietly skips without a Notification Module, an e-mail
 * address, or with notifications turned off.
 */
export async function notifyShipmentEvent(container: MedusaContainer, eventId: string): Promise<"sent" | "skipped"> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const opts = getTrackingOptions(container).notifications
  if (!opts.enabled || !container.hasRegistration(Modules.NOTIFICATION)) return "skipped"
  const svc = container.resolve(ZONE_RATE_MODULE) as any
  const event: ShipmentEventRecord & { shipment_id: string } = await svc.retrieveZoneRateShipmentEvent(eventId)
  if (!event.public || event.notified_at) return "skipped"
  const shipment: ShipmentRecord = await svc.retrieveZoneRateShipment(event.shipment_id)
  if (!shipment.email) return "skipped"

  const locale = buyerLocale(container, shipment)
  const machine = statusMachine(container)
  const templates = (getPluginOptions(container).tracking?.notifications as { templates?: Partial<Record<Locale, Partial<EmailTemplate>>> } | undefined)
    ?.templates
  const email = renderShipmentEmail(
    locale,
    {
      store_name: opts.storeName ?? (locale === "id" ? "toko kami" : "our store"),
      status: statusLabel(machine, event.status, locale),
      tracking_number: shipment.tracking_number,
      tracking_url: trackingUrl(container, shipment),
      order_display_id: shipment.order_display_id != null ? String(shipment.order_display_id) : shipment.order_id,
      location: event.location,
      note: event.note,
      date: new Date(event.occurred_at).toISOString(),
    },
    templates?.[locale]
  )
  try {
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: shipment.email,
      channel: opts.channel,
      template: `zone-rate.shipment-status`,
      content: email,
      data: {
        locale,
        tracking_number: shipment.tracking_number,
        status: event.status,
        order_id: shipment.order_id,
        tracking_url: trackingUrl(container, shipment),
      },
      trigger_type: "shipment.status_updated",
      resource_id: shipment.id,
      resource_type: "zone_rate_shipment",
      idempotency_key: `zone-rate:${event.id}:${shipment.email}`,
    } as any)
    await svc.updateZoneRateShipmentEvents({ id: event.id, notified_at: new Date() })
    return "sent"
  } catch (e) {
    logger.warn(`[zone-rate] could not e-mail ${shipment.tracking_number} (${event.status}): ${(e as Error).message}`)
    return "skipped"
  }
}
