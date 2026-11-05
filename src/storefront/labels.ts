export type TrackingLocale = "en" | "id"

export type TrackingLabels = {
  title: string
  intro: string
  inputLabel: string
  placeholder: string
  submit: string
  notFound: string
  notFoundHint: string
  invalid: string
  tooMany: string
  status: string
  destination: string
  shippedAt: string
  expected: string
  deliveredAt: string
  carrier: string
  carrierLink: string
  history: string
  live: string
  updated: string
  noEvents: string
  photos: string
  estimate: Record<"day" | "week" | "month", string>
}

export const LABELS: Record<TrackingLocale, TrackingLabels> = {
  id: {
    title: "Lacak pesanan",
    intro: "Masukkan nomor resi dari email konfirmasi pengiriman.",
    inputLabel: "Nomor resi",
    placeholder: "HK-261103-7K3QX9",
    submit: "Lacak",
    notFound: "Nomor resi tidak ditemukan",
    notFoundHint: "Periksa lagi nomornya. Resi baru aktif setelah pesanan diproses.",
    invalid: "Format nomor resi tidak dikenal. Contoh: HK-261103-7K3QX9",
    tooMany: "Terlalu banyak percobaan. Coba lagi sebentar lagi.",
    status: "Status",
    destination: "Tujuan",
    shippedAt: "Dikirim",
    expected: "Perkiraan tiba",
    deliveredAt: "Diterima",
    carrier: "Kurir",
    carrierLink: "Lacak di situs kurir",
    history: "Riwayat pengiriman",
    live: "Diperbarui otomatis",
    updated: "Status baru saja diperbarui",
    noEvents: "Belum ada riwayat.",
    photos: "Foto",
    estimate: { day: "{min}–{max} hari", week: "{min}–{max} minggu", month: "{min}–{max} bulan" },
  },
  en: {
    title: "Track your order",
    intro: "Enter the tracking number from your shipping e-mail.",
    inputLabel: "Tracking number",
    placeholder: "HK-261103-7K3QX9",
    submit: "Track",
    notFound: "Tracking number not found",
    notFoundHint: "Please check the number. Tracking starts once your order is being processed.",
    invalid: "That doesn't look like one of our tracking numbers, e.g. HK-261103-7K3QX9",
    tooMany: "Too many attempts. Please try again in a minute.",
    status: "Status",
    destination: "Destination",
    shippedAt: "Shipped",
    expected: "Expected by",
    deliveredAt: "Delivered",
    carrier: "Carrier",
    carrierLink: "Track on the carrier's site",
    history: "Shipment history",
    live: "Updates automatically",
    updated: "Status just updated",
    noEvents: "No history yet.",
    photos: "Photos",
    estimate: { day: "{min}–{max} days", week: "{min}–{max} weeks", month: "{min}–{max} months" },
  },
}

export const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""))

export function formatDateTime(iso: string, locale: TrackingLocale, timeZone?: string) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso))
}

export function formatDate(iso: string, locale: TrackingLocale, timeZone?: string) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", { dateStyle: "long", ...(timeZone ? { timeZone } : {}) }).format(
    new Date(iso)
  )
}

/** Client-side shape check, same rule as the server (prefix, 6 digits, 6 symbols); the server checks the check symbol */
export function looksLikeTrackingNumber(input: string) {
  return /^\s*[A-Za-z]{1,4}[\s-]*\d{6}[\s-]*[A-Za-z0-9]{6}\s*$/.test(input)
}

export function normalizeInput(input: string) {
  const m = /^\s*([A-Za-z]{1,4})[\s-]*(\d{6})[\s-]*([A-Za-z0-9]{6})\s*$/.exec(input)
  return m ? `${m[1]}-${m[2]}-${m[3]}`.toUpperCase() : input.trim().toUpperCase()
}
