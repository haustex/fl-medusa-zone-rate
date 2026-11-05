import { trackingBackend } from "@lib/zone-rate-tracking/backend"
import { getTracking } from "@modules/zone-rate-tracking/core/api"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Relays the public lookup for the live tracking card (the browser has no publishable key header for SSE) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  const locale = req.nextUrl.searchParams.get("locale") === "id" ? "id" : "en"
  const result = await getTracking(await trackingBackend(), number, locale)
  if (!result.ok) {
    return NextResponse.json({ type: result.reason }, { status: result.reason === "not_found" ? 404 : result.reason === "rate_limited" ? 429 : 502 })
  }
  return NextResponse.json({ shipment: result.shipment }, { headers: { "Cache-Control": "no-store" } })
}
