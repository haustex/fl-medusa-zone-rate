import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  cancelOrderFulfillmentWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"
import { resolveConfig } from "../config"
import { getProviderConfig, getTrackingOptions } from "../plugin-options"
import { quote } from "../quote"
import type { Estimate, Locale, QuoteItem } from "../types"
import { shipmentHub } from "./realtime"
import { buildStatusMachine, type StatusMachine } from "./statuses"
import { generateTrackingNumber } from "./tracking-number"

export const ZONE_RATE_MODULE = "zoneRate"
export const SHIPMENT_CREATED = "shipment.created"
export const SHIPMENT_STATUS_UPDATED = "shipment.status_updated"
const MAX_NUMBER_ATTEMPTS = 8

type Service = any

export type Actor = { id?: string | null; name?: string | null }

export type ShipmentRecord = {
  id: string
  order_id: string
  order_display_id: number | null
  email: string | null
  customer_name: string | null
  fulfillment_id: string | null
  service_id: string | null
  zone_id: string | null
  tracking_number: string
  carrier_name: string | null
  carrier_tracking_number: string | null
  carrier_tracking_url: string | null
  chargeable_kg: number | null
  shipping_amount: number | null
  currency_code: string | null
  destination: Record<string, string | null> | null
  estimate: Estimate | null
  status: string
  status_at: Date | string
  shipped_at: Date | string | null
  estimated_delivery_at: Date | string | null
  delivered_at: Date | string | null
  locale: string | null
  metadata: Record<string, unknown> | null
  created_at?: Date | string
  events?: ShipmentEventRecord[]
}

export type ShipmentEventRecord = {
  id: string
  status: string
  previous_status: string | null
  note: string | null
  location: string | null
  occurred_at: Date | string
  created_by: string | null
  created_by_name: string | null
  public: boolean
  photo_ids: string[] | null
  notified_at: Date | string | null
  created_at?: Date | string
}

const machines = new WeakMap<object, StatusMachine>()
export function statusMachine(container: MedusaContainer): StatusMachine {
  const key = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as object
  let m = machines.get(key)
  if (!m) {
    m = buildStatusMachine(getTrackingOptions(container).statuses)
    machines.set(key, m)
  }
  return m
}

/** Query returns quantities/amounts as BigNumber objects */
const num = (v: unknown): number => (v === null || v === undefined ? 0 : MathBN.convert(v as never).toNumber())

const service = (container: MedusaContainer): Service => container.resolve(ZONE_RATE_MODULE)

function isDuplicate(e: unknown) {
  const err = e as { type?: string; code?: string; message?: string }
  return err?.type === "duplicate_error" || err?.code === "23505" || /already exists|duplicate key/i.test(err?.message ?? "")
}

/** Runs `job` under the Locking Module (cross-process) when present, else a per-process lock. */
const localLocks = new Map<string, Promise<unknown>>()
async function withLock<T>(container: MedusaContainer, key: string, job: () => Promise<T>): Promise<T> {
  if (container.hasRegistration(Modules.LOCKING)) {
    const locking = container.resolve(Modules.LOCKING)
    return locking.execute(key, job, { timeout: 30 })
  }
  const prev = localLocks.get(key) ?? Promise.resolve()
  const run = prev.catch(() => {}).then(job)
  localLocks.set(key, run)
  try {
    return await run
  } finally {
    if (localLocks.get(key) === run) localLocks.delete(key)
  }
}

export function addEstimate(from: Date, estimate: Estimate | null | undefined): Date | null {
  if (!estimate) return null
  const d = new Date(from)
  if (estimate.unit === "day") d.setDate(d.getDate() + estimate.max)
  else if (estimate.unit === "week") d.setDate(d.getDate() + estimate.max * 7)
  else d.setMonth(d.getMonth() + estimate.max)
  return d
}

export function buyerLocale(container: MedusaContainer, shipment: Pick<ShipmentRecord, "locale" | "destination">): Locale {
  const pref = getTrackingOptions(container).notifications.locale
  if (pref === "en" || pref === "id") return pref
  if (shipment.locale === "id" || shipment.locale === "en") return shipment.locale
  return shipment.destination?.country_code === "id" ? "id" : "en"
}

export function trackingUrl(container: MedusaContainer, shipment: Pick<ShipmentRecord, "tracking_number" | "locale" | "destination">): string | null {
  const t = getTrackingOptions(container).notifications.trackingUrl
  if (!t) return null
  const template = typeof t === "string" ? t : t[buyerLocale(container, shipment)] ?? t.en ?? t.id
  return template ? template.replace("{tracking_number}", encodeURIComponent(shipment.tracking_number)) : null
}

function publish(container: MedusaContainer, update: Parameters<typeof shipmentHub.publish>[0]) {
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  shipmentHub.start(config.projectConfig?.redisUrl, container.resolve(ContainerRegistrationKeys.LOGGER))
  shipmentHub.publish(update)
}

async function emit(container: MedusaContainer, name: string, data: Record<string, unknown>) {
  try {
    const bus = container.resolve(Modules.EVENT_BUS)
    await bus.emit({ name, data })
  } catch (e) {
    container.resolve(ContainerRegistrationKeys.LOGGER).warn(`[zone-rate] could not emit ${name}: ${(e as Error).message}`)
  }
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "metadata",
  "shipping_address.*",
  "shipping_methods.shipping_option_id",
  "shipping_methods.amount",
  "items.id",
  "items.quantity",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.variant_id",
  "items.product_id",
  "items.requires_shipping",
  "items.variant.weight",
  "items.variant.length",
  "items.variant.width",
  "items.variant.height",
  // items.quantity is only filled when the detail's quantity is requested too
  "items.detail.quantity",
  "items.detail.fulfilled_quantity",
  "fulfillments.id",
  "fulfillments.canceled_at",
]

async function loadOrder(container: MedusaContainer, orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ORDER_FIELDS, filters: { id: orderId } })
  const order = data[0] as any
  if (!order) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found`)
  return order
}

/**
 * Creates the shipment record of an order (status "diproses") with a new
 * tracking number, or returns the open one it already has. Weight, price,
 * zone and destination are snapshots.
 */
export async function createShipmentForOrder(
  container: MedusaContainer,
  input: { order_id: string; actor?: Actor; metadata?: Record<string, unknown> }
): Promise<ShipmentRecord> {
  return withLock(container, `zone-rate:order:${input.order_id}`, async () => {
    const svc = service(container)
    const machine = statusMachine(container)
    const existing: ShipmentRecord[] = await svc.listZoneRateShipments({ order_id: input.order_id })
    const open = existing.find((s) => s.status !== "dibatalkan" && !machine.statuses.get(s.status)?.medusa?.startsWith("cancel"))
    if (open) return open

    const order = await loadOrder(container, input.order_id)
    const method = order.shipping_methods?.[0]
    let serviceId: string | null = null
    if (method?.shipping_option_id) {
      try {
        const option = await container.resolve(Modules.FULFILLMENT).retrieveShippingOption(method.shipping_option_id)
        serviceId = (option?.data as { id?: string } | null)?.id ?? null
      } catch {
        serviceId = null
      }
    }

    // Snapshot of weight/zone with the current config (null when not a zone-rate order)
    let zoneId: string | null = null
    let kg: number | null = null
    let estimate: Estimate | null = null
    const raw = getProviderConfig(container)
    if (raw && serviceId) {
      const config = resolveConfig(raw)
      estimate = config.services.get(serviceId)?.estimate ?? null
      const items: QuoteItem[] = (order.items ?? [])
        .filter((i: any) => i.requires_shipping !== false)
        .map((i: any) => ({
          variant_id: i.variant_id ?? i.id,
          product_id: i.product_id,
          title: i.product_title ?? i.title,
          quantity: num(i.quantity ?? i.detail?.quantity),
          weight: i.variant?.weight ?? null,
          length: i.variant?.length ?? null,
          width: i.variant?.width ?? null,
          height: i.variant?.height ?? null,
        }))
      const q = quote(config, {
        service_id: serviceId,
        currency_code: order.currency_code,
        country_code: order.shipping_address?.country_code,
        province: order.shipping_address?.province,
        items,
      })
      if (q.ok) {
        zoneId = q.zone_id
        kg = q.chargeable_kg
      }
    }

    const a = order.shipping_address ?? {}
    const destination = {
      first_name: a.first_name ?? null,
      last_name: a.last_name ?? null,
      company: a.company ?? null,
      address_1: a.address_1 ?? null,
      address_2: a.address_2 ?? null,
      city: a.city ?? null,
      province: a.province ?? null,
      postal_code: a.postal_code ?? null,
      country_code: a.country_code ?? null,
      phone: a.phone ?? null,
    }
    const opts = getTrackingOptions(container)
    const now = new Date()
    const locale = (order.metadata?.locale as string | undefined)?.slice(0, 2) ?? null

    let shipment: ShipmentRecord | null = null
    for (let attempt = 1; !shipment; attempt++) {
      try {
        shipment = await svc.createZoneRateShipments({
          order_id: order.id,
          order_display_id: order.display_id ?? null,
          email: order.email ?? null,
          customer_name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
          service_id: serviceId,
          zone_id: zoneId,
          tracking_number: generateTrackingNumber({ prefix: opts.prefix, timeZone: opts.timeZone, date: now }),
          chargeable_kg: kg,
          shipping_amount: method?.amount != null ? num(method.amount) : null,
          currency_code: order.currency_code ?? null,
          destination,
          estimate,
          status: machine.initial,
          status_at: now,
          locale: locale === "id" || locale === "en" ? locale : null,
          metadata: input.metadata ?? null,
        })
      } catch (e) {
        if (!isDuplicate(e) || attempt >= MAX_NUMBER_ATTEMPTS) throw e
      }
    }
    const event: ShipmentEventRecord = await svc.createZoneRateShipmentEvents({
      shipment_id: shipment.id,
      status: machine.initial,
      previous_status: null,
      occurred_at: now,
      created_by: input.actor?.id ?? null,
      created_by_name: input.actor?.name ?? null,
      public: true,
    })
    const payload = {
      id: shipment.id,
      shipment_id: shipment.id,
      order_id: shipment.order_id,
      tracking_number: shipment.tracking_number,
      status: shipment.status,
      previous_status: null,
      event_id: event.id,
      public: true,
    }
    await emit(container, SHIPMENT_CREATED, payload)
    publish(container, { ...payload, at: now.toISOString() })
    return shipment
  })
}

export type StatusUpdateInput = {
  shipment_id: string
  status: string
  note?: string | null
  location?: string | null
  occurred_at?: Date | string | null
  /** Default: the status's `public` setting (true) */
  public?: boolean
  photo_ids?: string[]
  actor?: Actor
  carrier?: { name?: string | null; tracking_number?: string | null; tracking_url?: string | null }
}

async function loadFulfillment(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "shipped_at", "delivered_at", "canceled_at", "items.line_item_id", "items.quantity"],
    filters: { id },
  })
  return data[0] as any
}

/** The shipment's Medusa fulfillment, created for every not-yet-fulfilled item when missing. */
async function ensureFulfillment(container: MedusaContainer, shipment: ShipmentRecord, actor?: Actor) {
  if (shipment.fulfillment_id) {
    const f = await loadFulfillment(container, shipment.fulfillment_id)
    if (f && !f.canceled_at) return f
  }
  const order = await loadOrder(container, shipment.order_id)
  const items = (order.items ?? [])
    .map((i: any) => ({ id: i.id, quantity: num(i.quantity ?? i.detail?.quantity) - num(i.detail?.fulfilled_quantity) }))
    .filter((i: { quantity: number }) => i.quantity > 0)
  if (!items.length) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Every item of this order is already in another fulfillment")
  }
  const { result } = await createOrderFulfillmentWorkflow(container).run({
    input: { order_id: shipment.order_id, items, created_by: actor?.id ?? undefined, no_notification: true },
  })
  const fulfillmentId = (result as { id: string }).id
  await service(container).updateZoneRateShipments({ id: shipment.id, fulfillment_id: fulfillmentId })
  shipment.fulfillment_id = fulfillmentId
  return loadFulfillment(container, fulfillmentId)
}

/**
 * Records a status (validated against the status machine), keeps Medusa's
 * fulfillment in step, appends the timeline event, then emits
 * `shipment.status_updated` and pushes the live update.
 */
export async function updateShipmentStatus(
  container: MedusaContainer,
  input: StatusUpdateInput
): Promise<{ shipment: ShipmentRecord; event: ShipmentEventRecord }> {
  return withLock(container, `zone-rate:shipment:${input.shipment_id}`, async () => {
    const svc = service(container)
    const machine = statusMachine(container)
    const shipment: ShipmentRecord = await svc.retrieveZoneRateShipment(input.shipment_id)
    machine.assertTransition(shipment.status, input.status)
    const def = machine.statuses.get(input.status)!
    const occurred = input.occurred_at ? new Date(input.occurred_at) : new Date()
    if (Number.isNaN(occurred.getTime())) throw new MedusaError(MedusaError.Types.INVALID_DATA, "occurred_at is not a date")
    if (occurred.getTime() > Date.now() + 5 * 60_000) throw new MedusaError(MedusaError.Types.INVALID_DATA, "occurred_at is in the future")

    const carrier = {
      carrier_name: input.carrier?.name !== undefined ? input.carrier.name || null : shipment.carrier_name,
      carrier_tracking_number:
        input.carrier?.tracking_number !== undefined ? input.carrier.tracking_number || null : shipment.carrier_tracking_number,
      carrier_tracking_url: input.carrier?.tracking_url !== undefined ? input.carrier.tracking_url || null : shipment.carrier_tracking_url,
    }
    if (carrier.carrier_tracking_url && !/^https?:\/\//i.test(carrier.carrier_tracking_url)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "carrier tracking link must start with http:// or https://")
    }

    // Medusa fulfillment in step with the status
    const updates: Record<string, unknown> = { ...carrier, status: input.status, status_at: occurred }
    if (def.medusa === "shipped" || def.medusa === "delivered") {
      const f = await ensureFulfillment(container, shipment, input.actor)
      if (!f.shipped_at) {
        const url = trackingUrl(container, shipment) ?? ""
        await createOrderShipmentWorkflow(container).run({
          input: {
            order_id: shipment.order_id,
            fulfillment_id: f.id,
            items: (f.items ?? []).map((i: any) => ({ id: i.line_item_id, quantity: num(i.quantity) })),
            labels: [{ tracking_number: shipment.tracking_number, tracking_url: url, label_url: url }],
            created_by: input.actor?.id ?? undefined,
            no_notification: true,
          },
        })
      }
      if (!shipment.shipped_at) {
        updates.shipped_at = occurred
        updates.estimated_delivery_at = addEstimate(occurred, shipment.estimate)
      }
      if (def.medusa === "delivered" && !f.delivered_at) {
        await markOrderFulfillmentAsDeliveredWorkflow(container).run({
          input: { orderId: shipment.order_id, fulfillmentId: f.id },
        })
      }
      if (def.medusa === "delivered") updates.delivered_at = occurred
    } else if (def.medusa === "canceled" && shipment.fulfillment_id) {
      const f = await loadFulfillment(container, shipment.fulfillment_id)
      if (f && !f.canceled_at && !f.shipped_at) {
        await cancelOrderFulfillmentWorkflow(container).run({
          input: { order_id: shipment.order_id, fulfillment_id: f.id, no_notification: true },
        })
      }
    }

    const event: ShipmentEventRecord = await svc.createZoneRateShipmentEvents({
      shipment_id: shipment.id,
      status: input.status,
      previous_status: shipment.status,
      note: input.note?.trim() || null,
      location: input.location?.trim() || null,
      occurred_at: occurred,
      created_by: input.actor?.id ?? null,
      created_by_name: input.actor?.name ?? null,
      public: input.public ?? def.public ?? true,
      photo_ids: input.photo_ids?.length ? input.photo_ids : null,
    })
    const updated: ShipmentRecord = await svc.updateZoneRateShipments({ id: shipment.id, ...updates })

    const payload = {
      id: shipment.id,
      shipment_id: shipment.id,
      order_id: shipment.order_id,
      tracking_number: shipment.tracking_number,
      status: input.status,
      previous_status: shipment.status,
      event_id: event.id,
      public: event.public,
    }
    await emit(container, SHIPMENT_STATUS_UPDATED, payload)
    publish(container, { ...payload, at: occurred.toISOString() })
    return { shipment: updated, event }
  })
}

/** Labels of a status in a language */
export function statusLabel(machine: StatusMachine, id: string, locale: Locale): string {
  const label = machine.statuses.get(id)?.label
  if (!label) return id
  return typeof label === "string" ? label : label[locale] ?? label.en
}

/**
 * What anyone with the tracking number may see: status, city/province/country
 * and times of the events marked public. No name, street, phone, notes or photos.
 */
export function publicTrackingView(machine: StatusMachine, shipment: ShipmentRecord, events: ShipmentEventRecord[], locale: Locale) {
  const d = shipment.destination ?? {}
  return {
    tracking_number: shipment.tracking_number,
    status: shipment.status,
    status_label: statusLabel(machine, shipment.status, locale),
    final: machine.isFinal(shipment.status),
    service_id: shipment.service_id,
    estimate: shipment.estimate,
    shipped_at: shipment.shipped_at,
    estimated_delivery_at: shipment.estimated_delivery_at,
    delivered_at: shipment.delivered_at,
    destination: { city: d.city ?? null, province: d.province ?? null, country_code: d.country_code ?? null },
    carrier: shipment.carrier_name
      ? { name: shipment.carrier_name, tracking_number: shipment.carrier_tracking_number, tracking_url: shipment.carrier_tracking_url }
      : null,
    events: events
      .filter((e) => e.public)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .map((e) => ({ status: e.status, label: statusLabel(machine, e.status, locale), location: e.location, occurred_at: e.occurred_at })),
  }
}

/** The buyer's own view (logged in, their order): public events with notes and photo ids */
export function customerTrackingView(machine: StatusMachine, shipment: ShipmentRecord, events: ShipmentEventRecord[], locale: Locale) {
  const base = publicTrackingView(machine, shipment, events, locale)
  const byId = new Map(events.map((e) => [e.id, e]))
  return {
    ...base,
    order_id: shipment.order_id,
    destination: shipment.destination,
    events: events
      .filter((e) => e.public)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .map((e) => ({
        id: e.id,
        status: e.status,
        label: statusLabel(machine, e.status, locale),
        location: e.location,
        note: byId.get(e.id)?.note ?? null,
        photo_ids: e.photo_ids ?? [],
        occurred_at: e.occurred_at,
      })),
  }
}
