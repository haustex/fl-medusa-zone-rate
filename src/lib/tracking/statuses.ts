import { MedusaError } from "@medusajs/framework/utils"
import type { Localized } from "../types"

/**
 * Shipment statuses and the transitions between them. Stores can relabel,
 * add statuses or change transitions through the `tracking.statuses` option;
 * `medusa` ties a status to Medusa's own fulfillment: "shipped" creates the
 * Medusa shipment (tracking number = our number), "delivered" marks the
 * fulfillment delivered.
 */
export type StatusDefinition = {
  id: string
  label: Localized
  /** Statuses allowed next. Empty = final. */
  next: string[]
  /** Default for "show to buyer" when an admin records this status. Default true. */
  public?: boolean
  medusa?: "shipped" | "delivered" | "canceled"
  /** Counts as "late" when still open past the estimate. Default: true unless final. */
  open?: boolean
}

const IN_TRANSIT = ["transit", "tiba_di_kota_tujuan", "dalam_pengantaran", "terkirim", "gagal_kirim"]

export const DEFAULT_STATUSES: StatusDefinition[] = [
  { id: "diproses", label: { en: "Processing", id: "Diproses" }, next: ["dikemas", "dibatalkan"] },
  { id: "dikemas", label: { en: "Packed", id: "Dikemas" }, next: ["diserahkan_ke_kurir", "dikirim", "dibatalkan"] },
  {
    id: "diserahkan_ke_kurir",
    label: { en: "Handed to carrier", id: "Diserahkan ke kurir" },
    next: IN_TRANSIT,
    medusa: "shipped",
  },
  { id: "dikirim", label: { en: "Shipped", id: "Dikirim" }, next: IN_TRANSIT, medusa: "shipped" },
  { id: "transit", label: { en: "In transit", id: "Transit" }, next: IN_TRANSIT },
  {
    id: "tiba_di_kota_tujuan",
    label: { en: "Arrived in destination city", id: "Tiba di kota tujuan" },
    next: ["dalam_pengantaran", "terkirim", "gagal_kirim"],
  },
  { id: "dalam_pengantaran", label: { en: "Out for delivery", id: "Dalam pengantaran" }, next: ["terkirim", "gagal_kirim"] },
  { id: "terkirim", label: { en: "Delivered", id: "Terkirim" }, next: [], medusa: "delivered" },
  {
    id: "gagal_kirim",
    label: { en: "Delivery failed", id: "Gagal kirim" },
    next: ["dalam_pengantaran", "transit", "dikembalikan"],
  },
  { id: "dikembalikan", label: { en: "Returned to sender", id: "Dikembalikan" }, next: [] },
  { id: "dibatalkan", label: { en: "Canceled", id: "Dibatalkan" }, next: [], medusa: "canceled" },
]

export const INITIAL_STATUS = "diproses"

export type StatusMachine = {
  statuses: Map<string, StatusDefinition>
  initial: string
  canTransition(from: string, to: string): boolean
  assertTransition(from: string, to: string): void
  isFinal(id: string): boolean
}

/**
 * Builds the machine from the defaults plus overrides: an entry with an
 * existing id replaces fields of that status; a new id adds a status (list it
 * in another status's `next` to reach it).
 */
export function buildStatusMachine(overrides: Partial<StatusDefinition>[] = [], initial = INITIAL_STATUS): StatusMachine {
  const statuses = new Map<string, StatusDefinition>(DEFAULT_STATUSES.map((s) => [s.id, { ...s, next: [...s.next] }]))
  for (const o of overrides) {
    if (!o.id || !/^[a-z0-9_]+$/.test(o.id)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `tracking status id "${o.id}" must be a-z, 0-9 or _`)
    const prev = statuses.get(o.id)
    if (!prev && (!o.label || !o.next)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `new tracking status "${o.id}" needs a label and next`)
    statuses.set(o.id, { ...(prev ?? ({} as StatusDefinition)), ...o } as StatusDefinition)
  }
  for (const s of statuses.values()) {
    for (const n of s.next) {
      if (!statuses.has(n)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `tracking status "${s.id}" lists unknown next status "${n}"`)
    }
  }
  if (!statuses.has(initial)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `initial tracking status "${initial}" is unknown`)

  const canTransition = (from: string, to: string) => !!statuses.get(from)?.next.includes(to)
  return {
    statuses,
    initial,
    canTransition,
    assertTransition(from, to) {
      if (!statuses.has(to)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown shipment status "${to}"`)
      if (!canTransition(from, to)) {
        const allowed = statuses.get(from)?.next ?? []
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `A shipment cannot go from "${from}" to "${to}"${allowed.length ? ` (allowed: ${allowed.join(", ")})` : " (final status)"}`
        )
      }
    },
    isFinal: (id) => (statuses.get(id)?.next.length ?? 0) === 0,
  }
}
