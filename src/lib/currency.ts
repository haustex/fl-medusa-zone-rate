import { MedusaError } from "@medusajs/framework/utils"
const SCALE = 1_000_000n

/**
 * Converts an integer amount of the base currency (Rp1.285.000) into whole
 * units of the target currency at a fixed rate (base units per 1 target
 * unit), rounded UP: Rp1.285.000 at 16.500 → $78 (77.87…).
 */
export function convertUp(baseAmount: number, rate: number): number {
  if (!Number.isInteger(baseAmount) || baseAmount < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "base amount must be a non-negative integer")
  if (!Number.isFinite(rate) || rate <= 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "exchange rate must be a positive number")
  const scaledRate = BigInt(Math.round(rate * Number(SCALE)))
  const num = BigInt(baseAmount) * SCALE
  return Number((num + scaledRate - 1n) / scaledRate)
}
