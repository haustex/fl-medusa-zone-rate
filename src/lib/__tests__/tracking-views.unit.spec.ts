import { compressPhoto, sniffImage } from "../tracking/photos"
import sharp from "sharp"
import { renderShipmentEmail } from "../tracking/notifications"
import { addEstimate, publicTrackingView, customerTrackingView, type ShipmentRecord } from "../tracking/shipments"
import { buildStatusMachine } from "../tracking/statuses"

const machine = buildStatusMachine()
const shipment: ShipmentRecord = {
  id: "zrshp_1",
  order_id: "order_1",
  order_display_id: 12,
  email: "buyer@example.com",
  customer_name: "Siti Aminah",
  fulfillment_id: null,
  service_id: "domestic",
  zone_id: "jawa",
  tracking_number: "HK-261103-7K3QX9",
  carrier_name: null,
  carrier_tracking_number: null,
  carrier_tracking_url: null,
  chargeable_kg: 2,
  shipping_amount: 60000,
  currency_code: "idr",
  destination: { first_name: "Siti", last_name: "Aminah", address_1: "Jl. Melati 7", city: "Semarang", province: "ID-JT", postal_code: "50111", country_code: "id", phone: "0812000" },
  estimate: { min: 2, max: 7, unit: "day" },
  status: "dikirim",
  status_at: "2026-11-03T03:00:00Z",
  shipped_at: "2026-11-03T03:00:00Z",
  estimated_delivery_at: null,
  delivered_at: null,
  locale: null,
  metadata: null,
}
const ev = (id: string, status: string, pub: boolean, at: string, note: string | null = null) => ({
  id, status, previous_status: null, note, location: "Jepara", occurred_at: at, created_by: "user_1", created_by_name: "Staf Gudang", public: pub, photo_ids: ["zrpho_1"], notified_at: null,
})
const events = [
  ev("e1", "diproses", true, "2026-11-02T01:00:00Z"),
  ev("e2", "dikemas", false, "2026-11-02T05:00:00Z", "rahasia internal"),
  ev("e3", "dikirim", true, "2026-11-03T03:00:00Z", "kurir Pak Budi 0812"),
]

describe("tracking views", () => {
  it("public view has no personal data, notes, photos or hidden events", () => {
    const v = publicTrackingView(machine, shipment, events, "id")
    const s = JSON.stringify(v)
    expect(v.destination).toEqual({ city: "Semarang", province: "ID-JT", country_code: "id" })
    expect(v.events.map((e) => e.status)).toEqual(["dikirim", "diproses"])
    expect(v.status_label).toBe("Dikirim")
    for (const secret of ["Siti", "Melati", "50111", "0812", "buyer@", "rahasia", "Pak Budi", "zrpho", "Staf Gudang", "order_1"]) expect(s).not.toContain(secret)
  })

  it("customer view adds notes and photos of public events only", () => {
    const v = customerTrackingView(machine, shipment, events, "en")
    expect(v.events.map((e) => e.note)).toEqual(["kurir Pak Budi 0812", null])
    expect(JSON.stringify(v)).not.toContain("rahasia")
    expect(v.events[0].label).toBe("Shipped")
  })

  it("estimated delivery from the ship date", () => {
    const d = new Date("2026-11-03T03:00:00Z")
    expect(addEstimate(d, { min: 2, max: 7, unit: "day" })!.toISOString()).toBe("2026-11-10T03:00:00.000Z")
    expect(addEstimate(d, { min: 1, max: 2, unit: "week" })!.toISOString()).toBe("2026-11-17T03:00:00.000Z")
    expect(addEstimate(d, { min: 1, max: 2, unit: "month" })!.toISOString()).toBe("2027-01-03T03:00:00.000Z")
    expect(addEstimate(d, null)).toBeNull()
  })
})

describe("shipment e-mail", () => {
  const vars = { store_name: "HAUS KAYU", status: "Dikirim", tracking_number: "HK-261103-7K3QX9", tracking_url: "https://hauskayu.com/lacak/HK-261103-7K3QX9", order_display_id: "12", location: "Jepara", note: null }

  it("Indonesian and English defaults", () => {
    const id = renderShipmentEmail("id", vars)
    expect(id.subject).toBe("Pesanan #12: Dikirim")
    expect(id.text).toContain("Nomor resi: HK-261103-7K3QX9")
    expect(id.text).toContain("Lokasi: Jepara")
    expect(id.text).not.toContain("Catatan")
    const en = renderShipmentEmail("en", { ...vars, status: "Shipped" })
    expect(en.subject).toBe("Order #12: Shipped")
    expect(en.html).toContain('<a href="https://hauskayu.com/lacak/HK-261103-7K3QX9">')
  })

  it("escapes HTML and strips newlines from the subject", () => {
    const e = renderShipmentEmail("en", { ...vars, note: "<img src=x onerror=alert(1)>", status: "Shipped\nBcc: x" })
    expect(e.html).not.toContain("<img")
    expect(e.html).toContain("&lt;img")
    expect(e.subject).not.toMatch(/\n/)
  })

  it("templates can be replaced", () => {
    const e = renderShipmentEmail("id", vars, { subject: "[{store_name}] {tracking_number}", text: "Status: {status}" })
    expect(e.subject).toBe("[HAUS KAYU] HK-261103-7K3QX9")
    expect(e.text).toBe("Status: Dikirim\n")
  })
})

describe("photo type sniffing", () => {
  it("by magic bytes", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg")
    expect(sniffImage(Buffer.from("89504e470d0a1a0a0000", "hex"))).toBe("image/png")
    expect(sniffImage(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp")
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull()
    expect(sniffImage(Buffer.from("%PDF-1.7"))).toBeNull()
  })
})

describe("photo compression", () => {
  it("resizes to 1600 px, WebP, strips EXIF/GPS, keeps orientation", async () => {
    // 4000×3000 JPEG with EXIF (orientation 6 = rotate 90°) and GPS-like metadata
    const jpeg = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#8b5e3c" } })
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneCo", Model: "X1" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "6/1 35/1 0/1" } } as never)
      .withMetadata({ orientation: 6 })
      .toBuffer()
    expect((await sharp(jpeg).metadata()).exif).toBeDefined()
    const out = await compressPhoto(jpeg)
    const meta = await sharp(out.data).metadata()
    expect(meta.format).toBe("webp")
    expect(Math.max(meta.width!, meta.height!)).toBe(1600)
    expect(meta.width).toBe(1200) // rotated upright: portrait
    expect(meta.exif).toBeUndefined()
    expect(meta.icc).toBeUndefined()
    expect(out.data.toString("latin1")).not.toMatch(/PhoneCo|GPS/)
  })

  it("never enlarges small photos", async () => {
    const png = await sharp({ create: { width: 300, height: 200, channels: 4, background: "#fff" } }).png().toBuffer()
    const out = await compressPhoto(png)
    expect([out.width, out.height]).toEqual([300, 200])
  })

  it("refuses non-images, corrupt images and > 10 MB", async () => {
    await expect(compressPhoto(Buffer.from("<svg onload=alert(1)>"))).rejects.toThrow(/JPEG, PNG or WebP/)
    await expect(compressPhoto(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(50)]))).rejects.toThrow(/Could not read/)
    await expect(compressPhoto(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow(/10 MB/)
  })
})
