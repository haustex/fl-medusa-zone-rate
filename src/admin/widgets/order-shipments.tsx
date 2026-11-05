import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  CONFIG_QUERY_KEY,
  createShipment,
  formatDateTime,
  getConfig,
  isLate,
  orderShipments,
  SHIPMENTS_KEY,
  STATUS_COLOR,
  statusLabel,
  subscribeShipments,
} from "../lib/api"

/** Order page: the order's shipments (tracking number, status, last event) or a button to create one */
const OrderShipmentsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { t, i18n } = useTranslation()
  const l = i18n.language.startsWith("id") ? "id" : "en"
  const qc = useQueryClient()
  const key = [...SHIPMENTS_KEY, "order", order.id]
  const { data: config } = useQuery({ queryKey: CONFIG_QUERY_KEY, queryFn: getConfig, staleTime: Infinity })
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => orderShipments(order.id), refetchInterval: 30_000 })
  useEffect(() => subscribeShipments((u) => u.order_id === order.id && qc.invalidateQueries({ queryKey: key })), [order.id])

  const create = useMutation({
    mutationFn: () => createShipment(order.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return null
  const shipments = data?.shipments ?? []
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t("zoneRate.shipments.widget.title")}</Heading>
      </div>
      {shipments.length === 0 ? (
        <div className="flex flex-col gap-3 px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">{t("zoneRate.shipments.widget.none")}</Text>
          <Button size="small" variant="secondary" isLoading={create.isPending} onClick={() => create.mutate()}>
            {t("zoneRate.shipments.widget.create")}
          </Button>
        </div>
      ) : (
        shipments.map((s) => {
          const last = s.events?.[0]
          return (
            <div key={s.id} className="flex flex-col gap-1 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Text size="small" weight="plus" className="font-mono">{s.tracking_number}</Text>
                <Badge size="2xsmall" color={STATUS_COLOR[s.status] ?? "grey"}>{statusLabel(config?.tracking, s.status, l)}</Badge>
                {isLate(s, config?.tracking) && <Badge size="2xsmall" color="red">{t("zoneRate.shipments.late")}</Badge>}
              </div>
              {last && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {formatDateTime(last.occurred_at, l)}
                  {last.location ? ` · ${last.location}` : ""}
                </Text>
              )}
              {s.carrier_name && (
                <Text size="xsmall" className="text-ui-fg-subtle">{s.carrier_name} {s.carrier_tracking_number}</Text>
              )}
              <Button size="small" variant="secondary" className="mt-2" asChild>
                <Link to={`/shipments/${s.id}`}>{t("zoneRate.shipments.widget.open")}</Link>
              </Button>
            </div>
          )
        })
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.details.side.before" })

export default OrderShipmentsWidget
