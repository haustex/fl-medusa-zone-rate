import type { ZoneRateConfig } from "medusa-fulfillment-zone-rate/types"

/**
 * Haus Kayu's shipping config (Jepara, Indonesia): one domestic service by
 * province zone (IDR) and two international services (rates in IDR,
 * converted to USD at a fixed rate). Copy it as a starting point for your
 * own store.
 */
const config: ZoneRateConfig = {
  currency: "idr",
  exchange_rates: {
    // IDR per 1 USD (example value, set your own). Update the date whenever you change the rate.
    usd: { rate: 16500, updated_at: "2026-11-03" },
  },
  units: { weight: "g", dimension: "cm" },
  volumetric_divisor: 6000,
  product_fallback: true,
  services: [
    {
      id: "domestic",
      name: { en: "Haus Kayu Shipping (Indonesia)", id: "Pengiriman Haus Kayu" },
      destination: "province",
      country: "id",
      estimate: { min: 2, max: 7, unit: "day" },
      zones: [
        {
          id: "jawa",
          name: "Jawa",
          rate_per_kg: 30000,
          provinces: ["ID-JK", "ID-JB", "ID-JT", "ID-YO", "ID-JI", "ID-BT"],
        },
        { id: "bali", name: "Bali", rate_per_kg: 40000, provinces: ["ID-BA"] },
        {
          id: "sumatra",
          name: "Sumatra",
          rate_per_kg: 75000,
          provinces: ["ID-AC", "ID-SU", "ID-SB", "ID-RI", "ID-KR", "ID-JA", "ID-SS", "ID-BB", "ID-BE", "ID-LA"],
        },
        {
          id: "sulawesi",
          name: "Sulawesi",
          rate_per_kg: 78000,
          provinces: ["ID-SA", "ID-GO", "ID-ST", "ID-SR", "ID-SN", "ID-SG"],
        },
        { id: "nusa-tenggara", name: "Nusa Tenggara", rate_per_kg: 80000, provinces: ["ID-NB", "ID-NT"] },
        {
          id: "kalimantan",
          name: "Kalimantan",
          rate_per_kg: 85000,
          provinces: ["ID-KB", "ID-KT", "ID-KS", "ID-KI", "ID-KU"],
        },
        { id: "maluku", name: "Maluku", rate_per_kg: 105000, provinces: ["ID-MA", "ID-MU"] },
        {
          id: "papua",
          name: "Papua",
          rate_per_kg: 250000,
          provinces: ["ID-PA", "ID-PB", "ID-PD", "ID-PT", "ID-PE", "ID-PS"],
        },
      ],
    },
    {
      id: "air",
      name: { en: "Air Freight", id: "Kargo Udara" },
      destination: "country",
      estimate: { min: 1, max: 2, unit: "week" },
      notice: {
        en: "Import duties and taxes are not included and are paid by you on delivery (DAP). The US currently charges duty on every imported parcel, with no low-value exemption, so the carrier will bill you when the package arrives.",
        id: "Bea masuk dan pajak impor belum termasuk dan dibayar pembeli saat barang tiba (DAP). AS saat ini mengenakan bea untuk semua paket impor tanpa pembebasan nilai kecil, jadi kurir akan menagih pembeli saat paket tiba.",
      },
      zones: [{ id: "us", name: "United States", rate_per_kg: 1285000, countries: ["us"] }],
    },
    {
      id: "sea",
      name: { en: "Sea Freight", id: "Kargo Laut" },
      destination: "country",
      estimate: { min: 1, max: 2, unit: "month" },
      notice: {
        en: "Import duties and taxes are not included and are paid by you on delivery (DAP). The US currently charges duty on every imported parcel, with no low-value exemption, so the carrier will bill you when the package arrives.",
        id: "Bea masuk dan pajak impor belum termasuk dan dibayar pembeli saat barang tiba (DAP). AS saat ini mengenakan bea untuk semua paket impor tanpa pembebasan nilai kecil, jadi kurir akan menagih pembeli saat paket tiba.",
      },
      zones: [{ id: "us", name: "United States", rate_per_kg: 250000, countries: ["us"] }],
    },
  ],
}

export default config
