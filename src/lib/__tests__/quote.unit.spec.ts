import hausKayu from "../../../examples/shipping.config.haus-kayu"
import { resolveConfig, ZoneRateConfigError } from "../config"
import { convertUp } from "../currency"
import { quote } from "../quote"
import type { QuoteItem, QuoteResult, QuoteSuccess, ZoneRateConfig } from "../types"
import { chargeableWeight } from "../weight"

/** Tests pin their own rate, independent of the example file */
const RATE = 16500
const config = resolveConfig({ ...hausKayu, exchange_rates: { usd: { rate: RATE, updated_at: "2026-11-03" } } })

/** 1 kg actual, 10×10×10 cm (0.17 kg volumetric) → 1 kg chargeable */
const item = (over: Partial<QuoteItem> = {}): QuoteItem => ({
  variant_id: "variant_1",
  title: "Talenan",
  quantity: 1,
  weight: 1000,
  length: 10,
  width: 10,
  height: 10,
  ...over,
})

const ok = (r: QuoteResult): QuoteSuccess => {
  if (!r.ok) throw new Error(`expected a quote, got ${r.reason}: ${r.message}`)
  return r
}

const domestic = (province: string, items: QuoteItem[] = [item()]) =>
  quote(config, { service_id: "domestic", currency_code: "idr", country_code: "id", province, items })

describe("domestic zones (1 kg)", () => {
  const cases: [string, string, number][] = [
    ["ID-JT", "jawa", 30000],
    ["ID-JK", "jawa", 30000],
    ["ID-BT", "jawa", 30000],
    ["ID-BA", "bali", 40000],
    ["ID-AC", "sumatra", 75000],
    ["ID-LA", "sumatra", 75000],
    ["ID-SN", "sulawesi", 78000],
    ["ID-GO", "sulawesi", 78000],
    ["ID-NB", "nusa-tenggara", 80000],
    ["ID-NT", "nusa-tenggara", 80000],
    ["ID-KU", "kalimantan", 85000],
    ["ID-MU", "maluku", 105000],
    ["ID-PA", "papua", 250000],
    ["ID-PS", "papua", 250000],
  ]
  it.each(cases)("%s → %s Rp%i", (province, zone, amount) => {
    const r = ok(domestic(province))
    expect(r.zone_id).toBe(zone)
    expect(r.amount).toBe(amount)
    expect(r.currency_code).toBe("idr")
  })

  it("covers all 38 provinces exactly once", () => {
    const zones = config.services.get("domestic")!.zoneByDestination
    expect(zones.size).toBe(38)
  })

  it("multiplies the rate by chargeable kg", () => {
    expect(ok(domestic("Papua", [item({ weight: 2500 })])).amount).toBe(3 * 250000)
  })
})

describe("international services (rates in IDR, cart in USD)", () => {
  const intl = (service_id: string, items: QuoteItem[] = [item()], currency_code = "usd") =>
    quote(config, { service_id, currency_code, country_code: "us", province: "CA", items })

  it("air: Rp1.285.000/kg → USD rounded up", () => {
    const r = ok(intl("air"))
    expect(r.base_amount).toBe(1285000)
    expect(r.amount).toBe(Math.ceil(1285000 / RATE)) // 77.87 → 78
    expect(r.amount).toBe(78)
    expect(r.exchange_rate).toEqual({ rate: RATE, updated_at: "2026-11-03" })
  })

  it("sea: Rp250.000/kg → USD rounded up", () => {
    const r = ok(intl("sea", [item({ weight: 3000 })]))
    expect(r.base_amount).toBe(750000)
    expect(r.amount).toBe(46) // 45.45 → 46
  })

  it("an IDR cart pays the IDR rate", () => {
    expect(ok(intl("air", [item()], "idr")).amount).toBe(1285000)
  })

  it("rejects another country, and a currency without a rate", () => {
    const r = quote(config, { service_id: "air", currency_code: "usd", country_code: "au", items: [item()] })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe("unsupported_country")
    const e = intl("sea", [item()], "eur")
    expect(!e.ok && e.reason).toBe("no_exchange_rate")
  })
})

describe("chargeable weight", () => {
  const kg = (grams: number) =>
    chargeableWeight([{ variant_id: "v", quantity: 1, weight: grams, length: 1, width: 1, height: 1 }], { divisor: 6000 })
      .chargeable_kg

  it.each([
    [300, 1],
    [1000, 1],
    [1100, 2],
    [2000, 2],
    [2010, 3],
    [1, 1],
    [999.9, 1],
    [1000.4, 2],
  ])("%i g → %i kg", (g, expected) => expect(kg(g)).toBe(expected))

  it("uses volumetric weight when it is larger", () => {
    // 40×30×20 = 24 000 cm³ / 6000 = 4 kg, actual 1.2 kg
    const r = chargeableWeight([{ variant_id: "v", quantity: 1, weight: 1200, length: 40, width: 30, height: 20 }], {
      divisor: 6000,
    })
    expect(r).toEqual({ actual_grams: 1200, volumetric_grams: 4000, chargeable_kg: 4 })
  })

  it("uses actual weight when it is larger", () => {
    // 10×10×10 = 0.167 kg volumetric, actual 3.2 kg
    const r = chargeableWeight([{ variant_id: "v", quantity: 1, weight: 3200, length: 10, width: 10, height: 10 }], {
      divisor: 6000,
    })
    expect(r.chargeable_kg).toBe(4)
    expect(r.volumetric_grams).toBe(167)
  })

  it("sums several lines with quantities before rounding", () => {
    // actual 2×400 + 3×150 = 1250 g; volumetric 2×(20×15×5=1500) + 3×(10×10×2=200) = 3600 cm³ = 0.6 kg
    const r = chargeableWeight(
      [
        { variant_id: "a", quantity: 2, weight: 400, length: 20, width: 15, height: 5 },
        { variant_id: "b", quantity: 3, weight: 150, length: 10, width: 10, height: 2 },
      ],
      { divisor: 6000 }
    )
    expect(r).toEqual({ actual_grams: 1250, volumetric_grams: 600, chargeable_kg: 2 })
  })

  it("volumetric across lines: 3 × 1.9 kg volumetric = 5.7 → 6", () => {
    // 30×20×19 = 11 400 cm³ = 1.9 kg each
    const r = chargeableWeight([{ variant_id: "a", quantity: 3, weight: 500, length: 30, width: 20, height: 19 }], {
      divisor: 6000,
    })
    expect(r.chargeable_kg).toBe(6)
  })

  it("honours the divisor, decimal dimensions and other units", () => {
    // 50×40×30 = 60 000 cm³: /5000 = 12 kg, /6000 = 10 kg
    const box = [{ variant_id: "v", quantity: 1, weight: 100, length: 50, width: 40, height: 30 }]
    expect(chargeableWeight(box, { divisor: 5000 }).chargeable_kg).toBe(12)
    expect(chargeableWeight(box, { divisor: 6000 }).chargeable_kg).toBe(10)
    // 30.5 × 20 × 10 = 6100 cm³ → 1.0167 → 2 kg
    expect(
      chargeableWeight([{ variant_id: "v", quantity: 1, weight: 100, length: 30.5, width: 20, height: 10 }], { divisor: 6000 })
        .chargeable_kg
    ).toBe(2)
    // 2.2 lb = 997.9 g → 1 kg; 2.3 lb = 1043 g → 2 kg
    const lb = (w: number) =>
      chargeableWeight([{ variant_id: "v", quantity: 1, weight: w, length: 1, width: 1, height: 1 }], {
        divisor: 6000,
        weightUnit: "lb",
        dimensionUnit: "in",
      }).chargeable_kg
    expect(lb(2.2)).toBe(1)
    expect(lb(2.3)).toBe(2)
  })

  it("applies minimum_kg", () => {
    expect(
      chargeableWeight([{ variant_id: "v", quantity: 1, weight: 300, length: 1, width: 1, height: 1 }], {
        divisor: 6000,
        minimumKg: 5,
      }).chargeable_kg
    ).toBe(5)
  })
})

describe("rejections (never 0)", () => {
  it.each(["Atlantis", "", "Jawa", "Kalimantan", "ID-XX"])("unknown province %p", (p) => {
    const r = domestic(p)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe("unknown_province")
    expect(!r.ok && r.raw_province).toBe(p || null)
  })

  it("no address / another country on the domestic service", () => {
    const none = quote(config, { service_id: "domestic", currency_code: "idr", items: [item()] })
    expect(!none.ok && none.reason).toBe("no_address")
    const us = quote(config, { service_id: "domestic", currency_code: "idr", country_code: "us", province: "Jawa Tengah", items: [item()] })
    expect(!us.ok && us.reason).toBe("unsupported_country")
  })

  it.each(["weight", "length", "width", "height"] as const)("line without %s", (field) => {
    const r = domestic("Jawa Tengah", [item({ variant_id: "ok_1" }), item({ variant_id: "bad_1", title: "Mangkuk", [field]: null })])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe("incomplete_items")
    expect(r.incomplete).toEqual([{ variant_id: "bad_1", product_id: null, title: "Mangkuk", missing: [field] }])
    expect(r.message).toContain("Mangkuk")
  })

  it("zero counts as missing", () => {
    const r = domestic("Jawa Tengah", [item({ weight: 0, height: 0 })])
    expect(!r.ok && r.incomplete[0].missing).toEqual(["weight", "height"])
  })

  it("falls back to the product's values, unless disabled", () => {
    const line = item({ weight: null, length: null, product_weight: 1500, product_length: 10 })
    expect(ok(domestic("Jawa Tengah", [line])).amount).toBe(60000)
    const strict = resolveConfig({ ...hausKayu, product_fallback: false })
    const r = quote(strict, { service_id: "domestic", currency_code: "idr", country_code: "id", province: "Jawa Tengah", items: [line] })
    expect(!r.ok && r.reason).toBe("incomplete_items")
  })

  it("unknown service and empty cart", () => {
    expect(quote(config, { service_id: "nope", currency_code: "idr", country_code: "id", province: "JT", items: [item()] }).ok).toBe(false)
    const empty = domestic("JT", [])
    expect(!empty.ok && empty.reason).toBe("no_items")
  })

  it("speaks the buyer's language", () => {
    const id = domestic("Atlantis")
    expect(!id.ok && id.locale).toBe("id")
    expect(!id.ok && id.message).toMatch(/Ongkir/)
    const en = quote(config, { service_id: "domestic", currency_code: "idr", country_code: "id", province: "Atlantis", locale: "en-US", items: [item()] })
    expect(!en.ok && en.message).toMatch(/We can't calculate shipping/)
  })

  it("every success is > 0 across random carts", () => {
    for (let i = 0; i < 500; i++) {
      const items = Array.from({ length: 1 + (i % 4) }, (_, j) =>
        item({ variant_id: `v${j}`, quantity: 1 + ((i + j) % 3), weight: 1 + ((i * 37 + j) % 4000), length: 1 + (i % 60), width: 1 + (j % 40), height: 1 + ((i + j) % 30) })
      )
      for (const s of ["domestic", "air", "sea"]) {
        const r = quote(config, { service_id: s, currency_code: s === "domestic" ? "idr" : "usd", country_code: s === "domestic" ? "id" : "us", province: "Jawa Tengah", items })
        expect(ok(r).amount).toBeGreaterThan(0)
      }
    }
  })
})

describe("currency conversion", () => {
  it.each([
    [1285000, 16500, 78],
    [250000, 16500, 16], // 15.15
    [330000, 16500, 20], // exact
    [330001, 16500, 21],
    [1, 16500, 1],
    [0, 16500, 0],
    [100000, 15872.5, 7], // 6.3
  ])("Rp%i at %d → %i", (base, rate, usd) => expect(convertUp(base, rate)).toBe(usd))

  it("rejects bad input", () => {
    expect(() => convertUp(1.5, 16500)).toThrow()
    expect(() => convertUp(100, 0)).toThrow()
  })
})

describe("config validation", () => {
  const base = (): ZoneRateConfig => JSON.parse(JSON.stringify(hausKayu))
  const bad = (mutate: (c: ZoneRateConfig) => void) => {
    const c = base()
    mutate(c)
    return () => resolveConfig(c)
  }

  it("accepts the example", () => expect(() => resolveConfig(base())).not.toThrow())
  it("rejects a 0 or decimal rate", () => {
    expect(bad((c) => (c.services[0].zones[0].rate_per_kg = 0))).toThrow(ZoneRateConfigError)
    expect(bad((c) => (c.services[0].zones[0].rate_per_kg = 1.5))).toThrow(/rate_per_kg/)
  })
  it("rejects an unknown province and a province in two zones", () => {
    expect(bad((c) => c.services[0].zones[0].provinces!.push("Atlantis"))).toThrow(/unknown province/)
    expect(bad((c) => c.services[0].zones[1].provinces!.push("Jateng"))).toThrow(/ID-JT is in zones/)
  })
  it("rejects duplicate services and missing options", () => {
    expect(bad((c) => c.services.push(c.services[0]))).toThrow(/used twice/)
    expect(() => resolveConfig(undefined)).toThrow(/missing/)
    expect(bad((c) => (c.exchange_rates!.usd.updated_at = "soon"))).toThrow(/updated_at/)
  })
  it("accepts province names in the config", () => {
    const c = base()
    c.services[0].zones[0].provinces = ["DKI Jakarta", "Jabar", "Jateng", "DIY", "Jatim", "Banten"]
    expect(resolveConfig(c).services.get("domestic")!.zoneByDestination.get("ID-YO")!.id).toBe("jawa")
  })
  it("applies minimum_charge", () => {
    const c = base()
    c.services[2].minimum_charge = 1000000
    const r = quote(resolveConfig(c), { service_id: "sea", currency_code: "idr", country_code: "us", items: [item()] })
    expect(ok(r).amount).toBe(1000000)
  })
})
