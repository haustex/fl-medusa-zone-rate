/**
 * Indonesian provinces (ISO 3166-2:ID, the 38 provinces since 2022) and a
 * tolerant matcher for free-text input: case, punctuation, "Provinsi"/"Prov."
 * prefixes, ISO codes with or without "ID-", common abbreviations (Jateng,
 * DIY, NTB, Kaltim, …), old/new spellings (Sumatra/Sumatera, Jogja) and the
 * English names.
 */

import { MedusaError } from "@medusajs/framework/utils"

export type ProvinceCode =
  | "ID-AC" | "ID-SU" | "ID-SB" | "ID-RI" | "ID-KR" | "ID-JA" | "ID-SS" | "ID-BB" | "ID-BE" | "ID-LA"
  | "ID-JK" | "ID-JB" | "ID-JT" | "ID-YO" | "ID-JI" | "ID-BT"
  | "ID-BA" | "ID-NB" | "ID-NT"
  | "ID-KB" | "ID-KT" | "ID-KS" | "ID-KI" | "ID-KU"
  | "ID-SA" | "ID-GO" | "ID-ST" | "ID-SR" | "ID-SN" | "ID-SG"
  | "ID-MA" | "ID-MU"
  | "ID-PA" | "ID-PB" | "ID-PD" | "ID-PT" | "ID-PE" | "ID-PS"

export type Province = {
  code: ProvinceCode
  /** Official Indonesian name */
  name: string
  /** English name */
  name_en: string
  aliases: string[]
}

export const PROVINCES: readonly Province[] = [
  { code: "ID-AC", name: "Aceh", name_en: "Aceh", aliases: ["NAD", "Nanggroe Aceh Darussalam", "Daerah Istimewa Aceh", "DI Aceh"] },
  { code: "ID-SU", name: "Sumatera Utara", name_en: "North Sumatra", aliases: ["Sumut", "Sumatra Utara"] },
  { code: "ID-SB", name: "Sumatera Barat", name_en: "West Sumatra", aliases: ["Sumbar", "Sumatra Barat"] },
  { code: "ID-RI", name: "Riau", name_en: "Riau", aliases: [] },
  { code: "ID-KR", name: "Kepulauan Riau", name_en: "Riau Islands", aliases: ["Kepri", "Kep. Riau", "Kep Riau"] },
  { code: "ID-JA", name: "Jambi", name_en: "Jambi", aliases: [] },
  { code: "ID-SS", name: "Sumatera Selatan", name_en: "South Sumatra", aliases: ["Sumsel", "Sumatra Selatan"] },
  {
    code: "ID-BB",
    name: "Kepulauan Bangka Belitung",
    name_en: "Bangka Belitung Islands",
    aliases: ["Babel", "Bangka Belitung", "Bangka-Belitung", "Kep. Bangka Belitung", "Kep Bangka Belitung"],
  },
  { code: "ID-BE", name: "Bengkulu", name_en: "Bengkulu", aliases: [] },
  { code: "ID-LA", name: "Lampung", name_en: "Lampung", aliases: [] },
  {
    code: "ID-JK",
    name: "DKI Jakarta",
    name_en: "Jakarta",
    aliases: [
      "DKI",
      "Jakarta",
      "Daerah Khusus Ibukota Jakarta",
      "Daerah Khusus Ibu Kota Jakarta",
      "Daerah Khusus Jakarta",
      "DK Jakarta",
      "Jakarta Raya",
      "Jakarta Special Capital Region",
      "Special Capital Region of Jakarta",
    ],
  },
  { code: "ID-JB", name: "Jawa Barat", name_en: "West Java", aliases: ["Jabar"] },
  { code: "ID-JT", name: "Jawa Tengah", name_en: "Central Java", aliases: ["Jateng"] },
  {
    code: "ID-YO",
    name: "DI Yogyakarta",
    name_en: "Special Region of Yogyakarta",
    aliases: [
      "DIY",
      "Yogyakarta",
      "Jogja",
      "Jogjakarta",
      "Yogya",
      "Djokjakarta",
      "Daerah Istimewa Yogyakarta",
      "D.I. Yogyakarta",
      "Yogyakarta Special Region",
    ],
  },
  { code: "ID-JI", name: "Jawa Timur", name_en: "East Java", aliases: ["Jatim"] },
  { code: "ID-BT", name: "Banten", name_en: "Banten", aliases: [] },
  { code: "ID-BA", name: "Bali", name_en: "Bali", aliases: [] },
  { code: "ID-NB", name: "Nusa Tenggara Barat", name_en: "West Nusa Tenggara", aliases: ["NTB"] },
  { code: "ID-NT", name: "Nusa Tenggara Timur", name_en: "East Nusa Tenggara", aliases: ["NTT"] },
  { code: "ID-KB", name: "Kalimantan Barat", name_en: "West Kalimantan", aliases: ["Kalbar"] },
  { code: "ID-KT", name: "Kalimantan Tengah", name_en: "Central Kalimantan", aliases: ["Kalteng"] },
  { code: "ID-KS", name: "Kalimantan Selatan", name_en: "South Kalimantan", aliases: ["Kalsel"] },
  { code: "ID-KI", name: "Kalimantan Timur", name_en: "East Kalimantan", aliases: ["Kaltim"] },
  { code: "ID-KU", name: "Kalimantan Utara", name_en: "North Kalimantan", aliases: ["Kaltara"] },
  { code: "ID-SA", name: "Sulawesi Utara", name_en: "North Sulawesi", aliases: ["Sulut"] },
  { code: "ID-GO", name: "Gorontalo", name_en: "Gorontalo", aliases: [] },
  { code: "ID-ST", name: "Sulawesi Tengah", name_en: "Central Sulawesi", aliases: ["Sulteng"] },
  { code: "ID-SR", name: "Sulawesi Barat", name_en: "West Sulawesi", aliases: ["Sulbar"] },
  { code: "ID-SN", name: "Sulawesi Selatan", name_en: "South Sulawesi", aliases: ["Sulsel"] },
  { code: "ID-SG", name: "Sulawesi Tenggara", name_en: "Southeast Sulawesi", aliases: ["Sultra"] },
  { code: "ID-MA", name: "Maluku", name_en: "Maluku", aliases: [] },
  { code: "ID-MU", name: "Maluku Utara", name_en: "North Maluku", aliases: ["Malut"] },
  { code: "ID-PA", name: "Papua", name_en: "Papua", aliases: ["Irian Jaya"] },
  { code: "ID-PB", name: "Papua Barat", name_en: "West Papua", aliases: ["Pabar", "Irian Jaya Barat"] },
  { code: "ID-PD", name: "Papua Barat Daya", name_en: "Southwest Papua", aliases: ["PBD"] },
  { code: "ID-PT", name: "Papua Tengah", name_en: "Central Papua", aliases: [] },
  { code: "ID-PE", name: "Papua Pegunungan", name_en: "Highland Papua", aliases: ["Papua Highlands"] },
  { code: "ID-PS", name: "Papua Selatan", name_en: "South Papua", aliases: [] },
]

const BY_CODE = new Map<string, Province>(PROVINCES.map((p) => [p.code, p]))

/** Lower case, no diacritics/punctuation, single spaces, no "provinsi" prefix or "province" suffix. */
export function normalizeProvince(input: string): string {
  let s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  s = s.replace(/^(provinsi|propinsi|prov|province of|province)\s+/, "")
  s = s.replace(/\s+(province|provinsi)$/, "")
  return s
}

const compact = (s: string) => s.replace(/ /g, "")

const ALIASES: Map<string, ProvinceCode> = (() => {
  const map = new Map<string, ProvinceCode>()
  const add = (alias: string, code: ProvinceCode) => {
    const n = normalizeProvince(alias)
    for (const key of [n, compact(n)]) {
      const prev = map.get(key)
      if (prev && prev !== code) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Province alias "${alias}" is ambiguous (${prev}, ${code})`)
      map.set(key, code)
    }
  }
  for (const p of PROVINCES) {
    for (const a of [p.name, p.name_en, ...p.aliases]) add(a, p.code)
    // "Sumatera"/"Sumatra" and "Jawa"/"Java" are interchangeable in every name
    for (const a of [p.name, ...p.aliases]) {
      if (/sumatera/i.test(a)) add(a.replace(/sumatera/i, "Sumatra"), p.code)
      if (/jawa/i.test(a)) add(a.replace(/jawa/i, "Java"), p.code)
    }
  }
  return map
})()

/**
 * The ISO 3166-2 code ("ID-JT") of an Indonesian province written in any of
 * the accepted forms, or null when it is not recognised.
 */
export function matchProvince(input: string | null | undefined): ProvinceCode | null {
  if (!input) return null
  const n = normalizeProvince(input)
  if (!n) return null

  // ISO code: "ID-JT", "id jt", "IDJT", "JT"
  const iso = /^(?:id ?)?([a-z]{2})$/.exec(n)
  if (iso) {
    const code = `ID-${iso[1].toUpperCase()}`
    if (BY_CODE.has(code)) return code as ProvinceCode
  }
  return ALIASES.get(n) ?? ALIASES.get(compact(n)) ?? null
}

export function getProvince(code: string): Province | undefined {
  return BY_CODE.get(code.toUpperCase())
}
