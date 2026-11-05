import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowDownTray, RocketLaunch } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Tabs, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { CreditFooter } from "../../components/credit-footer"
import {
  CONFIG_QUERY_KEY,
  downloadIncompleteCsv,
  formatDateTime,
  formatMoney,
  getConfig,
  listIncomplete,
  listRejections,
} from "../../lib/api"

const PAGE_SIZE = 25
const TABS = ["rates", "incomplete", "rejections"] as const
type Tab = (typeof TABS)[number]

const lang = (l: string) => (l.startsWith("id") ? "id" : "en")

const ZoneRatePage = () => {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab") as Tab | null
  const tab: Tab = requested && TABS.includes(requested) ? requested : "rates"

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading>{t("zoneRate.title")}</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {t("zoneRate.description")}
          </Text>
        </div>
        <div className="px-6 py-3">
          <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
            <Tabs.List className="flex-wrap">
              {TABS.map((k) => (
                <Tabs.Trigger key={k} value={k}>
                  {t(`zoneRate.tabs.${k}`)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs>
        </div>
        {tab === "rates" && <RatesTab />}
        {tab === "incomplete" && <IncompleteTab />}
        {tab === "rejections" && <RejectionsTab />}
      </Container>
      <CreditFooter />
    </div>
  )
}

const LoadError = () => {
  const { t } = useTranslation()
  return (
    <div className="px-6 py-4">
      <Text size="small" className="text-ui-fg-error">
        {t("zoneRate.loadError")}
      </Text>
    </div>
  )
}

const RatesTab = () => {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const { data, isLoading, isError } = useQuery({ queryKey: CONFIG_QUERY_KEY, queryFn: getConfig, staleTime: Infinity })
  if (isLoading) return null
  if (isError || !data) return <LoadError />
  if (!data.configured) {
    return (
      <div className="px-6 py-4">
        <Text size="small">{t("zoneRate.notConfigured")}</Text>
      </div>
    )
  }
  const rates = Object.entries(data.exchange_rates)
  return (
    <div className="flex flex-col gap-y-6 px-6 py-4">
      <div className="flex flex-col gap-y-1">
        <Text size="small" weight="plus">
          {t("zoneRate.rates.exchangeRate")}
        </Text>
        {rates.length ? (
          rates.map(([code, r]) => (
            <Text key={code} size="small" className="text-ui-fg-subtle">
              {t("zoneRate.rates.exchangeRateValue", { currency: code.toUpperCase(), amount: formatMoney(r.rate, data.currency, l) })}
              {" · "}
              {t("zoneRate.rates.updatedAt", { date: new Intl.DateTimeFormat(l === "id" ? "id-ID" : "en-US", { dateStyle: "long" }).format(new Date(r.updated_at)) })}
            </Text>
          ))
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            {t("zoneRate.rates.noExchangeRates")}
          </Text>
        )}
        <Text size="xsmall" className="text-ui-fg-muted mt-2">
          {t("zoneRate.rates.formula")} {t("zoneRate.rates.units", data.units)}{" "}
          {t(data.product_fallback ? "zoneRate.rates.fallbackOn" : "zoneRate.rates.fallbackOff")}
        </Text>
      </div>

      {data.services.map((s) => (
        <div key={s.id} className="flex flex-col gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h2">{s.name[l]}</Heading>
            <Badge size="2xsmall">{s.id}</Badge>
            {s.estimate && (
              <Badge size="2xsmall" color="blue">
                {t(`zoneRate.rates.estimate_${s.estimate.unit}`, s.estimate)}
              </Badge>
            )}
          </div>
          <Text size="xsmall" className="text-ui-fg-muted">
            {t("zoneRate.rates.divisor")}: {s.volumetric_divisor} · {t("zoneRate.rates.minimumKg")}: {s.minimum_kg} kg
            {s.minimum_charge !== null && ` · ${t("zoneRate.rates.minimumCharge")}: ${formatMoney(s.minimum_charge, data.currency, l)}`}
          </Text>
          {s.notice && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {s.notice[l]}
            </Text>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left">
              <thead className="bg-ui-bg-subtle">
                <tr>
                  <th className="txt-compact-small-plus px-3 py-2">{t("zoneRate.rates.zone")}</th>
                  <th className="txt-compact-small-plus px-3 py-2 text-right">{t("zoneRate.rates.perKg")}</th>
                  <th className="txt-compact-small-plus px-3 py-2">{t("zoneRate.rates.destinations")}</th>
                </tr>
              </thead>
              <tbody>
                {s.zones.map((z) => (
                  <tr key={z.id} className="border-t align-top">
                    <td className="txt-compact-small whitespace-nowrap px-3 py-2">{z.name[l]}</td>
                    <td className="txt-compact-small whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {formatMoney(z.rate_per_kg, data.currency, l)}
                    </td>
                    <td className="txt-small text-ui-fg-subtle px-3 py-2">{z.destinations.map((d) => d.name).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

const Pager = ({ offset, count, onChange }: { offset: number; count: number; onChange: (o: number) => void }) =>
  count > PAGE_SIZE ? (
    <div className="flex items-center justify-between px-6 py-3">
      <Text size="small" className="text-ui-fg-subtle">
        {offset + 1}–{Math.min(offset + PAGE_SIZE, count)} / {count}
      </Text>
      <div className="flex gap-2">
        <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}>
          ‹
        </Button>
        <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= count} onClick={() => onChange(offset + PAGE_SIZE)}>
          ›
        </Button>
      </div>
    </div>
  ) : null

const IncompleteTab = () => {
  const { t } = useTranslation()
  const [offset, setOffset] = useState(0)
  const [exporting, setExporting] = useState(false)
  const { data, isLoading, isError } = useQuery({
    queryKey: ["zone-rate", "incomplete", offset],
    queryFn: () => listIncomplete(offset, PAGE_SIZE),
    placeholderData: keepPreviousData,
  })
  if (isLoading) return null
  if (isError || !data) return <LoadError />
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          {t("zoneRate.incomplete.description")}
        </Text>
        {data.count > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge color="orange">{t("zoneRate.incomplete.count", { count: data.count })}</Badge>
            <Button
              size="small"
              variant="secondary"
              isLoading={exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  await downloadIncompleteCsv()
                } finally {
                  setExporting(false)
                }
              }}
            >
              <ArrowDownTray />
              {t("zoneRate.incomplete.export")}
            </Button>
          </div>
        )}
      </div>
      {data.count === 0 ? (
        <div className="px-6 pb-6">
          <Text size="small">{t("zoneRate.incomplete.empty")}</Text>
        </div>
      ) : (
        <ul className="divide-y border-t">
          {data.variants.map((v) => (
            <li key={v.variant_id} className="flex items-center gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <Text size="small" weight="plus" className="truncate">
                  {v.product_title}
                </Text>
                <Text size="small" className="text-ui-fg-subtle truncate">
                  {[v.variant_title, v.sku].filter(Boolean).join(" · ")}
                </Text>
                <div className="mt-1 flex flex-wrap gap-1">
                  {v.missing.map((m) => (
                    <Badge key={m} size="2xsmall" color="red">
                      {t(`zoneRate.incomplete.field_${m}`)}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button size="small" variant="secondary" asChild>
                <Link to={`/products/${v.product_id}/variants/${v.variant_id}`}>{t("zoneRate.incomplete.edit")}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Pager offset={offset} count={data.count} onChange={setOffset} />
    </div>
  )
}

const RejectionsTab = () => {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError } = useQuery({
    queryKey: ["zone-rate", "rejections", offset],
    queryFn: () => listRejections(offset, PAGE_SIZE),
    placeholderData: keepPreviousData,
  })
  if (isLoading) return null
  if (isError || !data) return <LoadError />
  return (
    <div className="flex flex-col">
      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          {t("zoneRate.rejections.description")}
        </Text>
      </div>
      {data.count === 0 ? (
        <div className="px-6 pb-6">
          <Text size="small">{t("zoneRate.rejections.empty")}</Text>
        </div>
      ) : (
        <ul className="divide-y border-t">
          {data.rejections.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-6 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="2xsmall" color={r.reason === "incomplete_items" ? "orange" : "red"}>
                  {t(`zoneRate.rejections.reason_${r.reason}`, { defaultValue: r.reason })}
                </Badge>
                <Badge size="2xsmall">{r.service_id}</Badge>
                {r.count > 1 && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t("zoneRate.rejections.times", { count: r.count })}
                  </Text>
                )}
                <Text size="xsmall" className="text-ui-fg-muted ml-auto">
                  {formatDateTime(r.last_seen_at, l)}
                </Text>
              </div>
              <Text size="small">
                {r.reason === "incomplete_items" && r.variants?.length
                  ? r.variants.map((v, i) => (
                      <span key={v.variant_id}>
                        {i > 0 && ", "}
                        {v.product_id ? (
                          <Link className="text-ui-fg-interactive hover:underline" to={`/products/${v.product_id}/variants/${v.variant_id}`}>
                            {v.title ?? v.variant_id}
                          </Link>
                        ) : (
                          v.title ?? v.variant_id
                        )}{" "}
                        <span className="text-ui-fg-muted">({v.missing.map((m) => t(`zoneRate.incomplete.field_${m}`)).join(", ")})</span>
                      </span>
                    ))
                  : [r.raw_province ? `“${r.raw_province}”` : null, r.country_code?.toUpperCase()].filter(Boolean).join(" · ") || "—"}
              </Text>
              {r.cart_id && (
                <Text size="xsmall" className="text-ui-fg-muted font-mono truncate">
                  {r.cart_id}
                </Text>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager offset={offset} count={data.count} onChange={setOffset} />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "zoneRate.label",
  translationNs: "translation",
  icon: RocketLaunch,
})

export const handle = {
  breadcrumb: () => <Breadcrumb />,
}

const Breadcrumb = () => {
  const { t } = useTranslation()
  return <>{t("zoneRate.label")}</>
}

export default ZoneRatePage
