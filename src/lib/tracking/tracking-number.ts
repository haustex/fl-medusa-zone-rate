import { randomInt } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

/**
 * Tracking numbers such as "HK-261103-7K3QX9": a prefix, the ship date
 * (YYMMDD in the store's time zone), five random symbols from Crockford's
 * base32 alphabet (no I, L, O, U) and one Luhn mod 32 check symbol that
 * catches every single-symbol typo. 25 random bits per day keep numbers
 * unguessable behind the lookup rate limit; uniqueness is enforced by the
 * database (unique index), with a retry on conflict.
 */

export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export const DEFAULT_PREFIX = "HK"
export const RANDOM_LENGTH = 5

const value = (symbol: string) => {
  const v = ALPHABET.indexOf(symbol)
  if (v < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, `"${symbol}" is not a tracking symbol`)
  return v
}

/** Luhn mod 32 over the given symbols */
export function checkSymbol(symbols: string): string {
  const n = ALPHABET.length
  let factor = 2
  let sum = 0
  for (let i = symbols.length - 1; i >= 0; i--) {
    let addend = factor * value(symbols[i])
    factor = factor === 2 ? 1 : 2
    addend = Math.floor(addend / n) + (addend % n)
    sum += addend
  }
  return ALPHABET[(n - (sum % n)) % n]
}

/** YYMMDD of `date` in `timeZone` */
export function datePart(date: Date, timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get("year")}${get("month")}${get("day")}`
}

export function isValidPrefix(prefix: string) {
  return /^[A-Z]{1,4}$/.test(prefix)
}

export function generateTrackingNumber(
  opts: { prefix?: string; date?: Date; timeZone?: string } = {},
  random: (max: number) => number = randomInt
): string {
  const prefix = opts.prefix ?? DEFAULT_PREFIX
  if (!isValidPrefix(prefix)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `tracking prefix "${prefix}" must be 1–4 letters A–Z`)
  const day = datePart(opts.date ?? new Date(), opts.timeZone)
  let body = ""
  for (let i = 0; i < RANDOM_LENGTH; i++) body += ALPHABET[random(ALPHABET.length)]
  // The check symbol covers the date too, so a mistyped date is caught as well
  return `${prefix}-${day}-${body}${checkSymbol(day + body)}`
}

/**
 * What a buyer typed → the canonical number, or null when it cannot be one of
 * ours (wrong shape or check symbol). Case, spaces, missing dashes and the
 * look-alikes I/L → 1 and O → 0 are forgiven.
 */
export function parseTrackingNumber(input: string | null | undefined): string | null {
  if (!input) return null
  const m = /^\s*([A-Za-z]{1,4})[\s-]*(\d{6})[\s-]*([A-Za-z0-9]{6})\s*$/.exec(input)
  if (!m) return null
  const prefix = m[1].toUpperCase()
  const body = m[3].toUpperCase().replace(/[IL]/g, "1").replace(/O/g, "0")
  if (/[^0-9A-HJKMNP-TV-Z]/.test(body)) return null
  if (checkSymbol(m[2] + body.slice(0, RANDOM_LENGTH)) !== body[RANDOM_LENGTH]) return null
  return `${prefix}-${m[2]}-${body}`
}
