import { trackingBackend } from "@lib/zone-rate-tracking/backend"
import { openTrackingStream, SSE_HEADERS } from "@modules/zone-rate-tracking/core/api"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/** Relays the plugin's SSE stream of one tracking number */
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  const upstream = await openTrackingStream(await trackingBackend(), number, req.signal).catch(() => null)
  if (!upstream?.ok || !upstream.body) return new Response(null, { status: upstream?.status ?? 502 })
  return new Response(upstream.body, { headers: SSE_HEADERS })
}
