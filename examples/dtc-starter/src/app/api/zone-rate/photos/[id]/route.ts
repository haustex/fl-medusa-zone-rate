import { trackingBackend } from "@lib/zone-rate-tracking/backend"
import { getPhoto } from "@modules/zone-rate-tracking/core/api"

export const dynamic = "force-dynamic"

/** A proof photo of the logged-in customer's own order */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getPhoto(await trackingBackend({ withCustomer: true }), id)
  if (!res.ok || !res.body) return new Response(null, { status: 404 })
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/webp",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
