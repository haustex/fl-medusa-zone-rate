import { z } from "@medusajs/framework/zod"

const status = z.string().trim().min(1).max(64)
const statusFields = {
  status,
  note: z.string().trim().max(2000).nullish(),
  location: z.string().trim().max(200).nullish(),
  occurred_at: z.string().datetime({ offset: true }).nullish(),
  public: z.boolean().optional(),
  photo_ids: z.array(z.string().startsWith("zrpho_")).max(5, "At most 5 photos per update").optional(),
}
const carrier = z
  .object({
    name: z.string().trim().max(100).nullish(),
    tracking_number: z.string().trim().max(100).nullish(),
    tracking_url: z.string().trim().url().max(500).nullish().or(z.literal("")),
  })
  .optional()

export const PostAdminShipmentStatus = z.object({ ...statusFields, carrier })
export type PostAdminShipmentStatusType = z.infer<typeof PostAdminShipmentStatus>

export const PostAdminBulkStatus = z.object({
  ids: z.array(z.string().startsWith("zrshp_")).min(1).max(100),
  status,
  note: statusFields.note,
  location: statusFields.location,
  public: statusFields.public,
})
export type PostAdminBulkStatusType = z.infer<typeof PostAdminBulkStatus>

export const PostAdminCreateShipment = z.object({ order_id: z.string().startsWith("order_") })
export type PostAdminCreateShipmentType = z.infer<typeof PostAdminCreateShipment>

export const PostAdminUpdateShipment = z.object({ carrier: carrier.unwrap() })
export type PostAdminUpdateShipmentType = z.infer<typeof PostAdminUpdateShipment>

/** Photos as data URLs (JPEG, PNG or WebP), up to 10 MB decoded (≈13.4 MB as base64) */
export const PostAdminShipmentPhoto = z.object({ data_url: z.string().max(14_000_000, "Photo is larger than 10 MB") })
export type PostAdminShipmentPhotoType = z.infer<typeof PostAdminShipmentPhoto>
