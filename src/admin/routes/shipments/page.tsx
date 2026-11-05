import { defineRouteConfig } from "@medusajs/admin-sdk"
import { TruckFast } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, Heading, Input, Select, Text, toast } from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { CreditFooter } from "../../components/credit-footer"
import {
  bulkStatus,
  CONFIG_QUERY_KEY,
  formatDateTime,
  getConfig,
  getSummary,
  isLate,
  listShipments,
  SHIPMENTS_KEY,
  STATUS_COLOR,
  statusLabel,
  subscribeShipments,
  type ShipmentFilters,
} from "../../lib/api"

const PAGE_SIZE = 25
const lang = (l: string) => (l.startsWith("id") ? "id" : "en")

/** Live updates through SSE; the queries also poll every 30 s as a fallback */
export function useLiveShipments() {
  const qc = useQueryClient()
  const [live, setLive] = useState(false)
  useEffect(() => {
    const close = subscribeShipments(() => {
      setLive(true)
      qc.invalidateQueries({ queryKey: SHIPMENTS_KEY })
    })
    setLive(typeof EventSource !== "undefined")
    return close
  }, [qc])
  return live
}

const ShipmentsPage = () => {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const filters: ShipmentFilters = {
    status: params.get("status") ?? undefined,
    service_id: params.get("service") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    late: params.get("late") === "1",
    q: params.get("q") ?? undefined,
  }
  const [search, setSearch] = useState(filters.q ?? "")
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTo, setBulkTo] = useState("")
  const live = useLiveShipments()

  const setFilter = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
    setOffset(0)
    setSelected(new Set())
  }
  useEffect(() => {
    const h = setTimeout(() => (search !== (filters.q ?? "") ? setFilter("q", search.trim() || null) : undefined), 350)
    return () => clearTimeout(h)
  }, [search])

  const { data: config } = useQuery({ queryKey: CONFIG_QUERY_KEY, queryFn: getConfig, staleTime: Infinity })
  const info = config?.tracking
  const { data: summary } = useQuery({ queryKey: [...SHIPMENTS_KEY, "summary"], queryFn: getSummary, refetchInterval: 30_000 })
  const { data, isLoading, isError } = useQuery({
    queryKey: [...SHIPMENTS_KEY, "list", filters, offset],
    queryFn: () => listShipments(filters, offset, PAGE_SIZE),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })

  const services = config?.configured ? config.services : []
  const serviceName = (id: string | null) => services.find((x) => x.id === id)?.name[l] ?? id
  const zoneName = (serviceId: string | null, zoneId: string | null) =>
    services.find((x) => x.id === serviceId)?.zones.find((z) => z.id === zoneId)?.name[l] ?? zoneId
  const statuses = info?.statuses ?? []
  // Statuses every selected shipment may move to
  const bulkTargets = useMemo(() => {
    const rows = (data?.shipments ?? []).filter((s) => selected.has(s.id))
    if (!rows.length) return []
    return statuses.filter((st) => rows.every((r) => statuses.find((x) => x.id === r.status)?.next.includes(st.id)))
  }, [data, selected, statuses])

  const bulk = useMutation({
    mutationFn: () => bulkStatus({ ids: [...selected], status: bulkTo }),
    onSuccess: (r) => {
      toast.success(t("zoneRate.shipments.bulkDone", r))
      setSelected(new Set())
      setBulkTo("")
      qc.invalidateQueries({ queryKey: SHIPMENTS_KEY })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = Object.values(summary?.by_status ?? {}).reduce((a, b) => a + b, 0)
  const chip = (active: boolean) =>
    `flex flex-col items-start justify-center rounded-lg border px-3 py-2 text-left ${active ? "border-ui-fg-base bg-ui-bg-base-pressed" : "bg-ui-bg-base"}`

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-start justify-between gap-2 px-6 py-4">
          <div>
            <Heading>{t("zoneRate.shipments.title")}</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {t("zoneRate.shipments.description")}
            </Text>
          </div>
          <Badge size="2xsmall" color={live ? "green" : "grey"}>
            {live ? t("zoneRate.shipments.live") : t("zoneRate.shipments.polling")}
          </Badge>
        </div>

        {/* Summary: tap a tile to filter */}
        <div className="flex gap-2 overflow-x-auto px-6 py-3">
          <button style={{ minHeight: 48, minWidth: 88 }} className={chip(!filters.status && !filters.late)} onClick={() => (setFilter("status", null), setFilter("late", null))}>
            <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.summary.all")}</Text>
            <Text weight="plus">{total}</Text>
          </button>
          <button style={{ minHeight: 48, minWidth: 88 }} className={chip(!!filters.late)} onClick={() => setFilter("late", filters.late ? null : "1")}>
            <Text size="xsmall" className="text-ui-fg-error">{t("zoneRate.shipments.summary.late")}</Text>
            <Text weight="plus">{summary?.late ?? 0}</Text>
          </button>
          <div style={{ minHeight: 48, minWidth: 88 }} className={chip(false)}>
            <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.summary.today")}</Text>
            <Text weight="plus">{summary?.shipped_today ?? 0}</Text>
          </div>
          {statuses
            .filter((s) => (summary?.by_status?.[s.id] ?? 0) > 0)
            .map((s) => (
              <button key={s.id} className={chip(filters.status === s.id)} onClick={() => setFilter("status", filters.status === s.id ? null : s.id)}>
                <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">{s.label[l]}</Text>
                <Text weight="plus">{summary?.by_status?.[s.id] ?? 0}</Text>
              </button>
            ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 px-6 py-3">
          <Input
            type="search"
            placeholder={t("zoneRate.shipments.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 44 }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v === "all" ? null : v)}>
              <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all">{t("zoneRate.shipments.allStatuses")}</Select.Item>
                {statuses.map((s) => (
                  <Select.Item key={s.id} value={s.id}>{s.label[l]}</Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Select value={filters.service_id ?? "all"} onValueChange={(v) => setFilter("service", v === "all" ? null : v)}>
              <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all">{t("zoneRate.shipments.allServices")}</Select.Item>
                {services.map((s) => (
                  <Select.Item key={s.id} value={s.id}>{s.name[l]}</Select.Item>
                ))}
              </Select.Content>
            </Select>
            <label className="flex flex-col gap-1">
              <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.from")}</Text>
              <Input type="date" value={filters.from?.slice(0, 10) ?? ""} onChange={(e) => setFilter("from", e.target.value || null)} style={{ height: 44 }} />
            </label>
            <label className="flex flex-col gap-1">
              <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.to")}</Text>
              <Input
                type="date"
                value={filters.to?.slice(0, 10) ?? ""}
                onChange={(e) => setFilter("to", e.target.value ? `${e.target.value}T23:59:59` : null)}
                style={{ height: 44 }}
              />
            </label>
          </div>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="bg-ui-bg-subtle flex flex-wrap items-center gap-2 px-6 py-3">
            <Text size="small" weight="plus">{t("zoneRate.shipments.selected", { count: selected.size })}</Text>
            <div className="min-w-[180px] flex-1">
              <Select value={bulkTo} onValueChange={setBulkTo}>
                <Select.Trigger style={{ height: 44 }}><Select.Value placeholder={t("zoneRate.shipments.bulkTo")} /></Select.Trigger>
                <Select.Content>
                  {bulkTargets.map((s) => (
                    <Select.Item key={s.id} value={s.id}>{s.label[l]}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Button size="large" disabled={!bulkTo} isLoading={bulk.isPending} onClick={() => bulk.mutate()}>
              {t("zoneRate.shipments.apply")}
            </Button>
          </div>
        )}

        {isError ? (
          <div className="px-6 py-4"><Text size="small" className="text-ui-fg-error">{t("zoneRate.loadError")}</Text></div>
        ) : isLoading ? null : !data?.count ? (
          <div className="px-6 py-6">
            <Text size="small">{filters.status || filters.q || filters.late ? t("zoneRate.shipments.noMatch") : t("zoneRate.shipments.empty")}</Text>
          </div>
        ) : (
          <ul className="divide-y">
            {data.shipments.map((s) => {
              const late = isLate(s, info)
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                  <label style={{ width: 44, height: 44 }} className="flex flex-none items-center justify-center" aria-label={t("zoneRate.shipments.select")}>
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={(c) =>
                        setSelected((prev) => {
                          const n = new Set(prev)
                          if (c) n.add(s.id)
                          else n.delete(s.id)
                          return n
                        })
                      }
                    />
                  </label>
                  <Link to={`/shipments/${s.id}`} className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1" style={{ minHeight: 56 }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Text size="small" weight="plus" className="font-mono">{s.tracking_number}</Text>
                      <Badge size="2xsmall" color={STATUS_COLOR[s.status] ?? "grey"}>{statusLabel(info, s.status, l)}</Badge>
                      {late && <Badge size="2xsmall" color="red">{t("zoneRate.shipments.late")}</Badge>}
                    </div>
                    <Text size="small" className="text-ui-fg-subtle truncate">
                      #{s.order_display_id} · {s.customer_name ?? s.email ?? "–"} · {[s.destination?.city, zoneName(s.service_id, s.zone_id)].filter(Boolean).join(" · ")}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">{formatDateTime(s.status_at, l)}{s.service_id ? ` · ${serviceName(s.service_id)}` : ""}</Text>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {data && data.count > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3">
            <Text size="small" className="text-ui-fg-subtle">{offset + 1}–{Math.min(offset + PAGE_SIZE, data.count)} / {data.count}</Text>
            <div className="flex gap-2">
              <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>‹</Button>
              <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= data.count} onClick={() => setOffset(offset + PAGE_SIZE)}>›</Button>
            </div>
          </div>
        )}
      </Container>
      <CreditFooter />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "zoneRate.shipments.label",
  translationNs: "translation",
  icon: TruckFast,
})

export const handle = {
  breadcrumb: () => <Breadcrumb />,
}

const Breadcrumb = () => {
  const { t } = useTranslation()
  return <>{t("zoneRate.shipments.label")}</>
}

export default ShipmentsPage
