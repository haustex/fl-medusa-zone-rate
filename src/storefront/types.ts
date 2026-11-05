/** GET /store/zone-rate/track/:number → shipment (public: no name, street, phone, notes or photos) */
export type PublicShipment = {
  tracking_number: string
  status: string
  status_label: string
  final: boolean
  service_id: string | null
  estimate: { min: number; max: number; unit: "day" | "week" | "month" } | null
  shipped_at: string | null
  estimated_delivery_at: string | null
  delivered_at: string | null
  destination: { city: string | null; province: string | null; country_code: string | null }
  carrier: { name: string; tracking_number: string | null; tracking_url: string | null } | null
  events: TrackingEvent[]
}

export type TrackingEvent = {
  id?: string
  status: string
  label: string
  location: string | null
  occurred_at: string
  /** Customer view only */
  note?: string | null
  photo_ids?: string[]
}

/** GET /store/zone-rate/orders/:id/shipments (logged-in customer, own order) */
export type CustomerShipment = Omit<PublicShipment, "destination"> & {
  order_id: string
  tracking_url: string | null
  destination: Record<string, string | null> | null
}

/** GET /store/zone-rate/services: the public rate card */
export type RateCard = {
  base_currency: string
  currency: string
  exchange_rate: { rate: number; updated_at: string } | null
  units: { weight: string; dimension: string }
  services: {
    id: string
    name: string
    destination: "province" | "country"
    estimate: { min: number; max: number; unit: "day" | "week" | "month" } | null
    notice: string | null
    volumetric_divisor: number
    minimum_kg: number
    minimum_charge: number | null
    zones: { id: string; name: string; rate_per_kg: number | null; rate_per_kg_base: number; destinations: string[] }[]
  }[]
}
