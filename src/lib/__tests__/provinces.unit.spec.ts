import { matchProvince, normalizeProvince, PROVINCES } from "../provinces"

describe("matchProvince", () => {
  it("has the 38 provinces with unique codes", () => {
    expect(PROVINCES).toHaveLength(38)
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(38)
  })

  it.each(PROVINCES.map((p) => [p.name, p.code]))("official name %s → %s", (name, code) => {
    expect(matchProvince(name)).toBe(code)
  })
  it.each(PROVINCES.map((p) => [p.name_en, p.code]))("English name %s → %s", (name, code) => {
    expect(matchProvince(name)).toBe(code)
  })
  it.each(PROVINCES.map((p) => [p.code, p.code]))("ISO %s", (input, code) => {
    expect(matchProvince(input)).toBe(code)
    expect(matchProvince(input.slice(3))).toBe(code) // "JT"
    expect(matchProvince(input.toLowerCase())).toBe(code)
  })

  // Every alias the spec requires
  const required: [string, string][] = [
    ["DKI", "ID-JK"],
    ["Jakarta", "ID-JK"],
    ["DKI Jakarta", "ID-JK"],
    ["Jabar", "ID-JB"],
    ["Jateng", "ID-JT"],
    ["Jatim", "ID-JI"],
    ["DIY", "ID-YO"],
    ["Yogyakarta", "ID-YO"],
    ["Jogja", "ID-YO"],
    ["Daerah Istimewa Yogyakarta", "ID-YO"],
    ["Sumut", "ID-SU"],
    ["Sumbar", "ID-SB"],
    ["Sumsel", "ID-SS"],
    ["Kepri", "ID-KR"],
    ["Babel", "ID-BB"],
    ["Bangka Belitung", "ID-BB"],
    ["NTB", "ID-NB"],
    ["Nusa Tenggara Barat", "ID-NB"],
    ["NTT", "ID-NT"],
    ["Kalbar", "ID-KB"],
    ["Kalteng", "ID-KT"],
    ["Kalsel", "ID-KS"],
    ["Kaltim", "ID-KI"],
    ["Kaltara", "ID-KU"],
    ["Sulut", "ID-SA"],
    ["Sulteng", "ID-ST"],
    ["Sulsel", "ID-SN"],
    ["Sultra", "ID-SG"],
    ["Sulbar", "ID-SR"],
    ["Malut", "ID-MU"],
    ["Papua Barat Daya", "ID-PD"],
    ["Papua Tengah", "ID-PT"],
    ["Papua Pegunungan", "ID-PE"],
    ["Papua Selatan", "ID-PS"],
  ]
  it.each(required)("alias %s → %s", (input, code) => expect(matchProvince(input)).toBe(code))

  it.each([
    ["  JAWA   tengah ", "ID-JT"],
    ["jawa-tengah", "ID-JT"],
    ["JawaTengah", "ID-JT"],
    ["Provinsi Jawa Tengah", "ID-JT"],
    ["Prov. Jawa Timur", "ID-JI"],
    ["Propinsi Bali", "ID-BA"],
    ["Central Java Province", "ID-JT"],
    ["ID-JT", "ID-JT"],
    ["id_jt", "ID-JT"],
    ["IDJT", "ID-JT"],
    ["jt", "ID-JT"],
    ["Sumatra Utara", "ID-SU"],
    ["Sumatera Utara", "ID-SU"],
    ["D.I. Yogyakarta", "ID-YO"],
    ["DI. Yogyakarta", "ID-YO"],
    ["d.k.i. jakarta", "ID-JK"],
    ["Kep. Riau", "ID-KR"],
    ["Kep. Bangka Belitung", "ID-BB"],
    ["Bangka-Belitung", "ID-BB"],
    ["Jogjakarta", "ID-YO"],
    ["Nanggroe Aceh Darussalam", "ID-AC"],
    ["NAD", "ID-AC"],
    ["Jawa Barat", "ID-JB"],
    ["West Java", "ID-JB"],
    ["Daerah Khusus Ibukota Jakarta", "ID-JK"],
    ["Papua", "ID-PA"],
    ["Papua Barat", "ID-PB"],
  ])("tolerant: %p → %s", (input, code) => expect(matchProvince(input)).toBe(code))

  it.each([null, undefined, "", "   ", "Jawa", "Sumatera", "Kalimantan", "Sulawesi", "California", "ID-XX", "XX", "-", "Atlantis"])(
    "unknown: %p",
    (input) => expect(matchProvince(input as string)).toBeNull()
  )

  it("normalizes", () => {
    expect(normalizeProvince("  Provinsi  D.I.  Yogyakarta ")).toBe("d i yogyakarta")
    expect(normalizeProvince("Sulawesi  Tenggara")).toBe("sulawesi tenggara")
  })
})
