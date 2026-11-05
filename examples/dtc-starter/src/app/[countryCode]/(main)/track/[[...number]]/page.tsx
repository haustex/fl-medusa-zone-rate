import { TrackingPage } from "@modules/zone-rate-tracking/tracking-page"
import { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
}

export default async function Page(props: {
  params: Promise<{ countryCode: string; number?: string[] }>
  searchParams: Promise<{ number?: string }>
}) {
  const [{ countryCode, number }, { number: query }] = await Promise.all([props.params, props.searchParams])
  return <TrackingPage countryCode={countryCode} number={number?.[0]} query={query} />
}
