import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getTrackingOptions } from "../lib/plugin-options"
import { createShipmentForOrder } from "../lib/tracking/shipments"

/**
 * Creates the shipment record (and tracking number) of zone-rate orders when
 * the payment is captured, or when the order is placed (option
 * `tracking.autoCreate`). Other shipping providers are left alone.
 */
export default async function zoneRateShipmentAutoCreate({ event, container }: SubscriberArgs<{ id: string }>) {
  const mode = getTrackingOptions(container).autoCreate
  if (!mode || mode !== event.name) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const orderId = event.name === "order.placed" ? event.data.id : await orderOfPayment(container, event.data.id)
    if (!orderId || !(await usesZoneRate(container, orderId))) return
    // "auto": nothing for canceled/archived/draft orders or orders that had a shipment before
    // (duplicate or replayed events stay idempotent)
    const shipment = await createShipmentForOrder(container, { order_id: orderId, mode: "auto" })
    if (shipment) logger.info(`[zone-rate] shipment ${shipment.tracking_number} for order ${orderId}`)
    else logger.debug(`[zone-rate] no new shipment for order ${orderId} (${event.name}): closed order or shipment exists`)
  } catch (e) {
    logger.warn(`[zone-rate] could not create the shipment (${event.name} ${event.data?.id}): ${(e as Error).message}`)
  }
}

async function orderOfPayment(container: SubscriberArgs<unknown>["container"], paymentId: string): Promise<string | null> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const row = await pg("payment as p")
    .join("order_payment_collection as opc", "opc.payment_collection_id", "p.payment_collection_id")
    .where("p.id", paymentId)
    .whereNull("opc.deleted_at")
    .first("opc.order_id")
  return row?.order_id ?? null
}

async function usesZoneRate(container: SubscriberArgs<unknown>["container"], orderId: string): Promise<boolean> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["shipping_methods.shipping_option_id"], filters: { id: orderId } })
  const ids = ((data[0] as any)?.shipping_methods ?? []).map((m: any) => m.shipping_option_id).filter(Boolean)
  if (!ids.length) return false
  const options = await container.resolve(Modules.FULFILLMENT).listShippingOptions({ id: ids }, { select: ["id", "provider_id"] })
  return options.some((o: { provider_id?: string | null }) => o.provider_id?.startsWith("zone-rate"))
}

export const config: SubscriberConfig = {
  event: ["payment.captured", "order.placed"],
  context: { subscriberId: "zone-rate-shipment-auto-create" },
}
