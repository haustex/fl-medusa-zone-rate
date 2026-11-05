import { decideShipmentCreation } from "../tracking/create-guard"

const open = { id: "zrshp_open", open: true }
const canceled = { id: "zrshp_canceled", open: false }

describe("shipment creation guard", () => {
  describe("auto (order.placed / payment.captured)", () => {
    it("creates the first shipment of a normal order", () => {
      for (const status of ["pending", "completed", "requires_action"]) {
        expect(decideShipmentCreation({ mode: "auto", orderStatus: status, existing: [] })).toEqual({ action: "create" })
      }
    })
    it("never for canceled, archived or draft orders", () => {
      for (const status of ["canceled", "archived", "draft"]) {
        expect(decideShipmentCreation({ mode: "auto", orderStatus: status, existing: [] })).toEqual({ action: "skip", reason: "order_closed" })
      }
    })
    it("duplicate or replayed event with an open shipment: nothing new", () => {
      expect(decideShipmentCreation({ mode: "auto", orderStatus: "pending", existing: [open] })).toEqual({
        action: "skip",
        reason: "already_has_shipment",
        shipment_id: "zrshp_open",
      })
    })
    it("replay after the shipment was canceled: nothing new (the bug fixed in 0.2.1)", () => {
      expect(decideShipmentCreation({ mode: "auto", orderStatus: "pending", existing: [canceled] })).toEqual({
        action: "skip",
        reason: "already_has_shipment",
        shipment_id: "zrshp_canceled",
      })
      expect(decideShipmentCreation({ mode: "auto", orderStatus: "canceled", existing: [canceled] }).action).toBe("skip")
    })
  })

  describe("manual (Admin)", () => {
    it("returns the open shipment instead of a second one", () => {
      expect(decideShipmentCreation({ mode: "manual", orderStatus: "pending", existing: [canceled, open] })).toEqual({
        action: "return_existing",
        shipment_id: "zrshp_open",
      })
    })
    it("refuses canceled, archived and draft orders", () => {
      for (const status of ["canceled", "archived", "draft"]) {
        expect(decideShipmentCreation({ mode: "manual", orderStatus: status, existing: [] })).toEqual({ action: "refuse", reason: "order_closed" })
      }
    })
    it("allows a deliberate re-issue after a canceled shipment", () => {
      expect(decideShipmentCreation({ mode: "manual", orderStatus: "pending", existing: [canceled] })).toEqual({ action: "create" })
    })
    it("unknown status is treated as open (older Medusa versions)", () => {
      expect(decideShipmentCreation({ mode: "manual", orderStatus: undefined, existing: [] })).toEqual({ action: "create" })
    })
  })
})
