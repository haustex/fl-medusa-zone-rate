import type { StatusDefinition } from "./statuses"

/**
 * Option `tracking.requirePaidBeforeShipping`: a shipped status is refused
 * while the order has an outstanding amount. Pure, unit-tested; the caller
 * loads the outstanding amount (order summary) only when this can matter.
 */
export function shippingGuardApplies(enabled: boolean, target: Pick<StatusDefinition, "medusa"> | undefined): boolean {
  return enabled === true && target?.medusa === "shipped"
}

export function shippingGuardMessage(input: {
  outstanding: number
  currency: string
  displayId?: number | string | null
}): string | null {
  if (!(input.outstanding > 0)) return null
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(input.outstanding)
  const order = input.displayId != null ? `Order #${input.displayId}` : "The order"
  return `${order} is not fully paid (${amount} ${input.currency.toUpperCase()} outstanding). Record the remaining payment before marking it as shipped.`
}
