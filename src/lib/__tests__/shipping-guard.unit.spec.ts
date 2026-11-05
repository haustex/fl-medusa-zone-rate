import { shippingGuardApplies, shippingGuardMessage } from "../tracking/shipping-guard"
import { buildStatusMachine } from "../tracking/statuses"

describe("tracking.requirePaidBeforeShipping", () => {
  const m = buildStatusMachine()

  it("is off by default: no status is checked", () => {
    for (const s of m.statuses.values()) expect(shippingGuardApplies(false, s)).toBe(false)
  })

  it("when on, only the shipped statuses are checked", () => {
    const checked = [...m.statuses.values()].filter((s) => shippingGuardApplies(true, s)).map((s) => s.id).sort()
    expect(checked).toEqual(["dikirim", "diserahkan_ke_kurir"])
  })

  it("custom statuses follow their medusa mapping", () => {
    const custom = buildStatusMachine([
      { id: "bahan_dipotong", label: { id: "Bahan dipotong", en: "Materials cut" }, next: ["dikemas"] },
      { id: "diproses", next: ["bahan_dipotong", "dikemas", "dibatalkan"] },
    ])
    expect(shippingGuardApplies(true, custom.statuses.get("bahan_dipotong"))).toBe(false)
    expect(shippingGuardApplies(true, undefined)).toBe(false)
  })

  it("no message when nothing is outstanding (or a refund is owed)", () => {
    expect(shippingGuardMessage({ outstanding: 0, currency: "idr" })).toBeNull()
    expect(shippingGuardMessage({ outstanding: -50000, currency: "idr" })).toBeNull()
    expect(shippingGuardMessage({ outstanding: Number.NaN, currency: "idr" })).toBeNull()
  })

  it("explains the outstanding amount", () => {
    expect(shippingGuardMessage({ outstanding: 6250000, currency: "idr", displayId: 16 })).toBe(
      "Order #16 is not fully paid (6,250,000 IDR outstanding). Record the remaining payment before marking it as shipped."
    )
  })
})
