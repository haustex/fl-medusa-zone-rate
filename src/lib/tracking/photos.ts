import sharp from "sharp"
import { MedusaError } from "@medusajs/framework/utils"

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_PHOTOS_PER_EVENT = 5
export const MAX_SIDE = 1600
export const WEBP_QUALITY = 80

/** Type from the file's first bytes, never from what the browser claims */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp"
  return null
}

/**
 * Proof photo → WebP: turned upright from its EXIF orientation, longest side at
 * most 1600 px (never enlarged), quality ~80, and every metadata block dropped
 * (EXIF, GPS, camera, ICC), so a phone photo of a parcel does not reveal where
 * the workshop is.
 */
export async function compressPhoto(input: Buffer): Promise<{ data: Buffer; width: number; height: number; mime_type: "image/webp" }> {
  if (input.length > MAX_UPLOAD_BYTES) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Photo is larger than 10 MB")
  if (!sniffImage(input)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Only JPEG, PNG or WebP photos")
  try {
    const { data, info } = await sharp(input, { failOn: "error", limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height, mime_type: "image/webp" }
  } catch (e) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Could not read the photo: ${(e as Error).message}`)
  }
}
