import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyShipmentEvent } from "../lib/tracking/notifications"

/** E-mails the buyer for every status shown to them (see lib/tracking/notifications.ts) */
export default async function zoneRateShipmentNotifications({ event, container }: SubscriberArgs<{ event_id: string; public: boolean }>) {
  if (!event.data?.event_id || event.data.public === false) return
  await notifyShipmentEvent(container, event.data.event_id)
}

export const config: SubscriberConfig = {
  event: ["shipment.created", "shipment.status_updated"],
  context: { subscriberId: "zone-rate-shipment-notifications" },
}
