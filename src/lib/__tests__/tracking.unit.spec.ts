import { buildStatusMachine, DEFAULT_STATUSES } from "../tracking/statuses"
import { checkSymbol, datePart, generateTrackingNumber, parseTrackingNumber } from "../tracking/tracking-number"

describe("tracking numbers", () => {
  const date = new Date("2026-11-03T20:30:00Z") // 4 Nov 03:30 in Jakarta

  it("has the HK-YYMMDD-XXXXXC shape with the store's date", () => {
    const n = generateTrackingNumber({ date, timeZone: "Asia/Jakarta" })
    expect(n).toMatch(/^HK-261104-[0-9A-HJKMNP-TV-Z]{6}$/)
    expect(datePart(date, "UTC")).toBe("261103")
  })

  it("is valid by its own check symbol and round-trips", () => {
    for (let i = 0; i < 2000; i++) {
      const n = generateTrackingNumber({ date })
      expect(parseTrackingNumber(n)).toBe(n)
    }
  })

  it("is unique in practice (random part)", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => generateTrackingNumber({ date })))
    expect(seen.size).toBeGreaterThan(4990)
  })

  it("catches every single-symbol typo in the date and random part", () => {
    const n = generateTrackingNumber({ date }, () => 7)
    const [prefix, day, body] = n.split("-")
    const chars = (day + body).split("")
    for (let i = 0; i < chars.length; i++) {
      const pool = i < 6 ? "0123456789" : "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
      for (const c of pool) {
        if (c === chars[i]) continue
        const t = [...chars]
        t[i] = c
        const typo = `${prefix}-${t.slice(0, 6).join("")}-${t.slice(6).join("")}`
        expect(parseTrackingNumber(typo)).toBeNull()
      }
    }
  })

  it("forgives case, spaces, dashes and look-alikes", () => {
    const n = generateTrackingNumber({ date }, (max) => (max === 32 ? 0 : 0))
    const body = n.split("-")[2]
    expect(parseTrackingNumber(n.toLowerCase())).toBe(n)
    expect(parseTrackingNumber(` hk 261103 ${body} `)).toBe(n)
    expect(parseTrackingNumber(`HK261103${body}`)).toBe(n)
    // random part "00000": typed with letter O instead of zero
    expect(parseTrackingNumber(`HK-261103-${body.replace(/0/g, "O")}`)).toBe(n)
  })

  it("rejects garbage", () => {
    for (const s of ["", "HK", "HK-261103", "HK-2611-ABCDEF", "1234", "HK-261103-ABCDE", "HK-261103-ABCDEUU", "<script>"]) {
      expect(parseTrackingNumber(s)).toBeNull()
    }
  })

  it("custom prefix", () => {
    expect(generateTrackingNumber({ prefix: "SHOP", date })).toMatch(/^SHOP-261103-/)
    expect(() => generateTrackingNumber({ prefix: "hk1" })).toThrow()
  })

  it("check symbol is deterministic", () => expect(checkSymbol("26110300000")).toBe(checkSymbol("26110300000")))
})

describe("status machine", () => {
  const m = buildStatusMachine()

  it.each([
    ["diproses", "dikemas"],
    ["dikemas", "dikirim"],
    ["dikemas", "diserahkan_ke_kurir"],
    ["dikirim", "transit"],
    ["transit", "transit"],
    ["transit", "tiba_di_kota_tujuan"],
    ["tiba_di_kota_tujuan", "dalam_pengantaran"],
    ["dalam_pengantaran", "terkirim"],
    ["dalam_pengantaran", "gagal_kirim"],
    ["gagal_kirim", "dalam_pengantaran"],
    ["gagal_kirim", "dikembalikan"],
    ["diproses", "dibatalkan"],
    ["dikirim", "terkirim"],
  ])("%s → %s is allowed", (a, b) => expect(() => m.assertTransition(a, b)).not.toThrow())

  it.each([
    ["diproses", "terkirim"],
    ["diproses", "dikirim"],
    ["terkirim", "transit"],
    ["terkirim", "dibatalkan"],
    ["dibatalkan", "diproses"],
    ["dikembalikan", "dikirim"],
    ["dikirim", "dikemas"],
    ["dikirim", "dibatalkan"],
    ["dikemas", "nope"],
  ])("%s → %s is refused", (a, b) => expect(() => m.assertTransition(a, b)).toThrow())

  it("final statuses", () => {
    expect(m.isFinal("terkirim")).toBe(true)
    expect(m.isFinal("dikembalikan")).toBe(true)
    expect(m.isFinal("transit")).toBe(false)
  })

  it("every default status is reachable from the initial one", () => {
    const seen = new Set([m.initial])
    const queue = [m.initial]
    while (queue.length) for (const n of m.statuses.get(queue.shift()!)!.next) if (!seen.has(n)) seen.add(n), queue.push(n)
    expect([...seen].sort()).toEqual(DEFAULT_STATUSES.map((s) => s.id).sort())
  })

  it("can be extended and relabelled from config", () => {
    const custom = buildStatusMachine([
      { id: "ditahan_bea_cukai", label: { en: "Held at customs", id: "Ditahan bea cukai" }, next: ["transit", "dikembalikan"] },
      { id: "transit", next: [...m.statuses.get("transit")!.next, "ditahan_bea_cukai"] },
      { id: "dikemas", label: { en: "Packed & labelled", id: "Dikemas" } },
    ])
    expect(custom.canTransition("transit", "ditahan_bea_cukai")).toBe(true)
    expect(custom.canTransition("ditahan_bea_cukai", "transit")).toBe(true)
    expect(custom.statuses.get("dikemas")!.next).toContain("dikirim")
    expect(() => buildStatusMachine([{ id: "x_y", label: "X", next: ["missing"] }])).toThrow(/unknown next/)
    expect(() => buildStatusMachine([{ id: "Bad Id", label: "X", next: [] }])).toThrow()
  })
})
