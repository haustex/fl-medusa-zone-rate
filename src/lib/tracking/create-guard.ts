/**
 * When a shipment may be created for an order (pure, unit-tested).
 *
 * - "auto" (subscriber on order.placed / payment.captured): never for an order
 *   that is canceled, archived or still a draft, and never when the order has
 *   had any shipment before, canceled ones included. Replayed or duplicate
 *   events therefore never create a second tracking number.
 * - "manual" (Admin "Create shipment"): refused for canceled, archived and
 *   draft orders; returns the open shipment when there is one; a new one after
 *   a canceled shipment is allowed (a deliberate re-issue by an admin).
 */
export type CreateMode = "auto" | "manual"

export const CLOSED_ORDER_STATUSES = ["canceled", "archived", "draft"] as const

export type CreateDecision =
  | { action: "create" }
  | { action: "return_existing"; shipment_id: string }
  | { action: "skip"; reason: "order_closed" | "already_has_shipment"; shipment_id?: string }
  | { action: "refuse"; reason: "order_closed" }

export function decideShipmentCreation(input: {
  mode: CreateMode
  orderStatus: string | null | undefined
  /** All shipments of the order, any status */
  existing: { id: string; open: boolean }[]
}): CreateDecision {
  const open = input.existing.find((s) => s.open)
  if (open) return input.mode === "auto" ? { action: "skip", reason: "already_has_shipment", shipment_id: open.id } : { action: "return_existing", shipment_id: open.id }
  const closed = (CLOSED_ORDER_STATUSES as readonly string[]).includes(String(input.orderStatus ?? ""))
  if (input.mode === "auto") {
    if (input.existing.length) return { action: "skip", reason: "already_has_shipment", shipment_id: input.existing[0].id }
    if (closed) return { action: "skip", reason: "order_closed" }
    return { action: "create" }
  }
  if (closed) return { action: "refuse", reason: "order_closed" }
  return { action: "create" }
}
