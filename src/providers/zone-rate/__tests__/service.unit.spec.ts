import hausKayu from "../../../../examples/shipping.config.haus-kayu"
import ZoneRateProviderService from "../service"

/** Just enough of knex for the provider: product lookup, rejection update/insert. */
function fakePg(products: Record<string, Record<string, number | null>> = {}) {
  const rejections: Record<string, unknown>[] = []
  const pg: any = (table: string) => {
    const state: { where: Record<string, unknown>; ids?: string[] } = { where: {} }
    const b: any = {
      select: () => b,
      whereIn: (_c: string, ids: string[]) => ((state.ids = ids), b),
      whereNull: () => b,
      where: (w: any, v?: unknown) => {
        if (typeof w === "string") state.where[w] = v
        else if (typeof w === "object") Object.assign(state.where, w)
        return b
      },
      andWhere: (fn: (q: any) => any) => (fn(b), b),
      update: async () => {
        const hit = rejections.find((r) => r.signature === state.where.signature && r.cart_id === (state.where.cart_id ?? null))
        if (!hit) return 0
        hit.count = (hit.count as number) + 1
        return 1
      },
      insert: async (row: Record<string, unknown>) => {
        rejections.push(row)
      },
      then: (resolve: (rows: unknown[]) => void) =>
        resolve(table === "product" ? (state.ids ?? []).filter((id) => products[id]).map((id) => ({ id, ...products[id] })) : []),
    }
    return b
  }
  pg.raw = (s: string) => s
  return { pg, rejections }
}

const logger: any = { warn: jest.fn(), info: jest.fn(), error: jest.fn() }

const line = (over: Record<string, any> = {}) => ({
  id: "item_1",
  quantity: 1,
  title: "Talenan Jati Klasik",
  variant_title: "30 x 20 cm",
  variant_id: "variant_1",
  product_id: "prod_1",
  requires_shipping: true,
  variant: { id: "variant_1", weight: 1200, length: 30, width: 20, height: 3, product: { id: "prod_1" } },
  product: { id: "prod_1", weight: 1200 },
  ...over,
})

const context = (over: Record<string, any> = {}): any => ({
  id: "cart_1",
  currency_code: "idr",
  shipping_address: { country_code: "id", province: "Jawa Tengah" },
  items: [line()],
  ...over,
})

const make = (products?: Record<string, Record<string, number | null>>) => {
  const db = fakePg(products)
  const provider = new ZoneRateProviderService({ logger, __pg_connection__: db.pg } as any, hausKayu)
  return { provider, ...db }
}

describe("ZoneRateProviderService", () => {
  it("lists one fulfillment option per service", async () => {
    const { provider } = make()
    const options = await provider.getFulfillmentOptions()
    expect(options.map((o) => o.id)).toEqual(["domestic", "air", "sea"])
    expect(await provider.canCalculate({ data: { id: "air" } } as any)).toBe(true)
    expect(await provider.canCalculate({ data: { id: "nope" } } as any)).toBe(false)
  })

  it("prices Jawa Tengah: 1.2 kg → 2 kg × Rp30.000", async () => {
    const { provider, rejections } = make()
    const price = await provider.calculatePrice({ id: "domestic" }, {}, context())
    expect(price).toEqual({ calculated_amount: 60000, is_calculated_price_tax_inclusive: true })
    expect(rejections).toHaveLength(0)
  })

  it("prices Papua with qty", async () => {
    const { provider } = make()
    const price = await provider.calculatePrice(
      { id: "domestic" },
      {},
      context({ shipping_address: { country_code: "id", province: "ID-PA" }, items: [line({ quantity: 3 })] })
    )
    expect(price.calculated_amount).toBe(4 * 250000) // 3.6 kg → 4
  })

  it("prices US air freight in USD", async () => {
    const { provider } = make()
    const price = await provider.calculatePrice(
      { id: "air" },
      {},
      context({ currency_code: "usd", shipping_address: { country_code: "us", province: "CA" } })
    )
    expect(price.calculated_amount).toBe(Math.ceil((2 * 1285000) / hausKayu.exchange_rates!.usd.rate))
  })

  it("refuses an unknown province with a message, and logs it once per cart", async () => {
    const { provider, rejections } = make()
    const ctx = context({ shipping_address: { country_code: "id", province: "Atlantis" } })
    await expect(provider.calculatePrice({ id: "domestic" }, {}, ctx)).rejects.toThrow(/Atlantis/)
    await expect(provider.calculatePrice({ id: "domestic" }, {}, ctx)).rejects.toThrow()
    expect(rejections).toHaveLength(1)
    expect(rejections[0]).toMatchObject({ cart_id: "cart_1", reason: "unknown_province", raw_province: "Atlantis", count: 2 })
  })

  it("refuses a line without dimensions and logs the variant", async () => {
    const { provider, rejections } = make()
    const bad = line({ variant: { id: "variant_2", weight: 600, length: null, width: null, height: null, product: { id: "prod_2" } }, variant_id: "variant_2", product_id: "prod_2", title: "Mangkuk Jati Bubut", variant_title: "Diameter 20 cm" })
    await expect(provider.calculatePrice({ id: "domestic" }, {}, context({ items: [line(), bad] }))).rejects.toThrow(/Mangkuk Jati Bubut/)
    expect(rejections).toHaveLength(1)
    expect(JSON.parse(rejections[0].variants as string)).toEqual([
      { variant_id: "variant_2", product_id: "prod_2", title: "Mangkuk Jati Bubut — Diameter 20 cm", missing: ["length", "width", "height"] },
    ])
  })

  it("falls back to the product's dimensions from the database", async () => {
    const { provider } = make({ prod_2: { weight: 600, length: 25, width: 25, height: 10 } })
    const bare = line({ variant: { id: "variant_2", weight: null, length: null, width: null, height: null }, variant_id: "variant_2", product_id: "prod_2", product: { id: "prod_2", weight: 600 } })
    // 25×25×10 = 6250 cm³ = 1.04 kg volumetric > 0.6 kg actual → 2 kg
    const price = await provider.calculatePrice({ id: "domestic" }, {}, context({ items: [bare] }))
    expect(price.calculated_amount).toBe(60000)
  })

  it("prices a custom line without a variant from metadata.zone_rate_package", async () => {
    const { provider, rejections } = make()
    const custom = {
      id: "item_c",
      quantity: 2,
      title: "Meja makan jati custom",
      requires_shipping: true,
      metadata: { zone_rate_package: { weight: 45000, length: 190, width: 100, height: 20 } },
    }
    // per unit: 190×100×20 / 6000 = 63.4 kg volumetric > 45 kg → ×2 = 126.7 → 127 kg × Rp30.000
    const price = await provider.calculatePrice({ id: "domestic" }, {}, context({ items: [custom] }))
    expect(price.calculated_amount).toBe(127 * 30000)
    expect(rejections).toHaveLength(0)
  })

  it("lets the line package win over the variant, ignoring invalid values", async () => {
    const { provider } = make()
    const over = line({ metadata: { zone_rate_package: { weight: 5000, length: "x", width: 0, height: null } } })
    // weight 5 kg from the package; dimensions 30×20×3 from the variant → 5 kg × Rp30.000
    const price = await provider.calculatePrice({ id: "domestic" }, {}, context({ items: [over] }))
    expect(price.calculated_amount).toBe(150000)
  })

  it("still refuses a custom line without a package", async () => {
    const { provider } = make()
    const custom = { id: "item_c", quantity: 1, title: "Lemari custom", requires_shipping: true, metadata: {} }
    await expect(provider.calculatePrice({ id: "domestic" }, {}, context({ items: [custom] }))).rejects.toThrow(/Lemari custom/)
  })

  it("skips lines that need no shipping", async () => {
    const { provider } = make()
    const digital = line({ id: "item_2", requires_shipping: false, variant: { id: "v_d", weight: null } })
    const price = await provider.calculatePrice({ id: "domestic" }, {}, context({ items: [line(), digital] }))
    expect(price.calculated_amount).toBe(60000)
  })

  it("never quotes without logging when there is no database", async () => {
    const provider = new ZoneRateProviderService({ logger } as any, hausKayu)
    await expect(
      provider.calculatePrice({ id: "domestic" }, {}, context({ shipping_address: { country_code: "id", province: "", address_1: "Jl. A" } }))
    ).rejects.toThrow(/provinsi/)
    expect(logger.warn).toHaveBeenCalled()
  })

  it("does not log a cart that has no address yet", async () => {
    const { provider, rejections } = make()
    await expect(
      provider.calculatePrice({ id: "domestic" }, {}, context({ shipping_address: { country_code: "id", province: null } }))
    ).rejects.toThrow()
    expect(rejections).toHaveLength(0)
    await expect(
      provider.calculatePrice({ id: "domestic" }, {}, context({ shipping_address: { country_code: "id", province: "", address_1: "Jl. A" } }))
    ).rejects.toThrow()
    expect(rejections).toHaveLength(1)
  })

  it("fails at startup on a bad config", () => {
    expect(() => new ZoneRateProviderService({ logger } as any, { services: [] } as any)).toThrow(/invalid config/)
  })
})
