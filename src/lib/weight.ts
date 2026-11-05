import { MedusaError } from "@medusajs/framework/utils"
import type { DimensionUnit, IncompleteItem, QuoteItem, WeightUnit } from "./types"

/**
 * Chargeable weight with integer arithmetic only (BigInt), so no float
 * rounding can move a parcel into the next kilogram:
 *
 *   actual     = Σ weight × qty
 *   volumetric = Σ L × W × H / divisor × qty        (cm³ / divisor = kg)
 *   chargeable = max(actual, volumetric) in kg, rounded UP to a whole kg, at least `minimumKg`
 *
 * Inputs are converted once to integer milligrams and integer 10-µm steps
 * (0.01 mm), which keeps decimals such as 30.5 cm or 0.75 lb exact enough.
 */

const MG_PER: Record<WeightUnit, number> = { g: 1_000, kg: 1_000_000, lb: 453_592.37, oz: 28_349.523125 }
/** Length steps of 10 µm per unit */
const STEPS_PER: Record<DimensionUnit, number> = { mm: 100, cm: 1_000, m: 100_000, in: 2_540 }
/** (steps per cm)³ */
const STEPS3_PER_CM3 = 1_000n ** 3n

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b

export type WeighedItem = {
  variant_id: string
  quantity: number
  weight: number
  length: number
  width: number
  height: number
}

export type WeightBreakdown = {
  actual_grams: number
  volumetric_grams: number
  chargeable_kg: number
}

const present = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0

/**
 * Picks each value from the variant, else (when allowed) the product, and
 * lists the lines that still miss the weight or a dimension.
 */
export function resolveItems(
  items: QuoteItem[],
  productFallback: boolean
): { items: WeighedItem[]; incomplete: IncompleteItem[] } {
  const out: WeighedItem[] = []
  const incomplete: IncompleteItem[] = []
  for (const it of items) {
    const pick = (own: number | null | undefined, product: number | null | undefined) =>
      present(own) ? own : productFallback && present(product) ? product : null
    const values = {
      weight: pick(it.weight, it.product_weight),
      length: pick(it.length, it.product_length),
      width: pick(it.width, it.product_width),
      height: pick(it.height, it.product_height),
    }
    const missing = (Object.keys(values) as (keyof typeof values)[]).filter((k) => values[k] === null)
    if (missing.length) {
      incomplete.push({ variant_id: it.variant_id, product_id: it.product_id ?? null, title: it.title ?? null, missing })
      continue
    }
    out.push({ variant_id: it.variant_id, quantity: it.quantity, ...(values as Record<keyof typeof values, number>) })
  }
  return { items: out, incomplete }
}

export function chargeableWeight(
  items: WeighedItem[],
  opts: { divisor: number; weightUnit?: WeightUnit; dimensionUnit?: DimensionUnit; minimumKg?: number }
): WeightBreakdown {
  const mgPer = MG_PER[opts.weightUnit ?? "g"]
  const stepsPer = STEPS_PER[opts.dimensionUnit ?? "cm"]
  if (!Number.isInteger(opts.divisor) || opts.divisor <= 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "volumetric divisor must be a positive integer")
  const divisor = BigInt(opts.divisor)

  let mg = 0n
  let volume = 0n // steps³
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, `invalid quantity for ${it.variant_id}`)
    const qty = BigInt(it.quantity)
    mg += BigInt(Math.round(it.weight * mgPer)) * qty
    const l = BigInt(Math.round(it.length * stepsPer))
    const w = BigInt(Math.round(it.width * stepsPer))
    const h = BigInt(Math.round(it.height * stepsPer))
    volume += l * w * h * qty
  }

  // volumetric kg = cm³ / divisor = volume / (steps³ per cm³ × divisor)
  const volDen = STEPS3_PER_CM3 * divisor
  const actualKg = ceilDiv(mg, 1_000_000n)
  const volumetricKg = ceilDiv(volume, volDen)
  const minimum = BigInt(Math.max(1, Math.ceil(opts.minimumKg ?? 1)))
  let kg = actualKg > volumetricKg ? actualKg : volumetricKg
  if (kg < minimum) kg = minimum

  return {
    actual_grams: Number(ceilDiv(mg, 1_000n)),
    volumetric_grams: Number(ceilDiv(volume * 1_000n, volDen)),
    chargeable_kg: Number(kg),
  }
}

/**
 * Per-line package: `line_item.metadata.zone_rate_package` = { weight, length, width, height } per unit, in the
 * config's units. For lines without a variant (e.g. a custom item on a draft order) or to override the variant.
 * Only positive finite numbers count; anything else falls through to the variant/product values.
 */
export const LINE_PACKAGE_KEY = "zone_rate_package"

export function linePackage(metadata: Record<string, unknown> | null | undefined): {
  weight: number | null
  length: number | null
  width: number | null
  height: number | null
} {
  const raw = metadata?.[LINE_PACKAGE_KEY]
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const pos = (v: unknown) => {
    const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null
  }
  return { weight: pos(p.weight), length: pos(p.length), width: pos(p.width), height: pos(p.height) }
}
