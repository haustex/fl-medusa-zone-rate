import { ArrowUturnLeft, Camera, DocumentText, XMark } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { CreditFooter } from "../../../components/credit-footer"
import {
  CONFIG_QUERY_KEY,
  fileToDataUrl,
  formatDateTime,
  formatMoney,
  getConfig,
  getShipment,
  isLate,
  photoUrl,
  SHIPMENTS_KEY,
  STATUS_COLOR,
  statusLabel,
  subscribeShipments,
  updateCarrier,
  updateStatus,
  uploadPhoto,
} from "../../../lib/api"
import { labelHtml, packingSlipHtml, printHtml } from "../../../lib/print"

const lang = (l: string) => (l.startsWith("id") ? "id" : "en")
const MAX_PHOTOS = 5

/** "2026-11-03T14:05" in the browser's time zone, for <input type="datetime-local"> */
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

/**
 * One screen per shipment, made for a phone in the workshop: big status
 * buttons, camera upload, then save. Everything above the fold first.
 */
const ShipmentDetailPage = () => {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const qc = useQueryClient()
  const key = [...SHIPMENTS_KEY, "detail", id]
  const { data: config } = useQuery({ queryKey: CONFIG_QUERY_KEY, queryFn: getConfig, staleTime: Infinity })
  const info = config?.tracking
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => getShipment(id!), enabled: !!id, refetchInterval: 30_000 })
  const s = data?.shipment

  useEffect(() => subscribeShipments((u) => u.shipment_id === id && qc.invalidateQueries({ queryKey: key })), [id])

  const current = info?.statuses.find((x) => x.id === s?.status)
  const nextStatuses = useMemo(() => (current?.next ?? []).map((n) => info!.statuses.find((x) => x.id === n)!).filter(Boolean), [current, info])

  const [next, setNext] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [location, setLocation] = useState("")
  const [when, setWhen] = useState(localInput(new Date()))
  const [isPublic, setIsPublic] = useState(true)
  const [photos, setPhotos] = useState<{ id: string; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const choose = (statusId: string) => {
    setNext(statusId)
    setIsPublic(info?.statuses.find((x) => x.id === statusId)?.public ?? true)
    setWhen(localInput(new Date()))
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files || !s) return
    setUploading(true)
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const dataUrl = await fileToDataUrl(file)
        const { photo } = await uploadPhoto(s.id, dataUrl)
        setPhotos((p) => [...p, { id: photo.id, preview: URL.createObjectURL(file) }])
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const save = useMutation({
    mutationFn: () =>
      updateStatus(s!.id, {
        status: next!,
        note: note || null,
        location: location || null,
        occurred_at: new Date(when).toISOString(),
        public: isPublic,
        photo_ids: photos.map((p) => p.id),
      }),
    onSuccess: () => {
      toast.success(t("zoneRate.shipments.detail.saved"))
      setNext(null)
      setNote("")
      setPhotos([])
      qc.invalidateQueries({ queryKey: SHIPMENTS_KEY })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const [carrier, setCarrier] = useState({ name: "", tracking_number: "", tracking_url: "" })
  useEffect(() => {
    if (s) setCarrier({ name: s.carrier_name ?? "", tracking_number: s.carrier_tracking_number ?? "", tracking_url: s.carrier_tracking_url ?? "" })
  }, [s?.carrier_name, s?.carrier_tracking_number, s?.carrier_tracking_url])
  const saveCarrier = useMutation({
    mutationFn: () => updateCarrier(s!.id, carrier),
    onSuccess: () => {
      toast.success(t("zoneRate.shipments.detail.saved"))
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const print = async (kind: "label" | "slip") => {
    if (!s) return
    const serviceName = config?.configured ? config.services.find((x) => x.id === s.service_id)?.name[l] : null
    const html = kind === "label" ? await labelHtml(s, info, l, serviceName) : packingSlipHtml(s, info, l)
    if (!printHtml(html)) toast.error(t("zoneRate.shipments.detail.popupBlocked"))
  }

  if (isLoading) return null
  if (isError || !s) {
    return (
      <Container><Text size="small" className="text-ui-fg-error">{t("zoneRate.loadError")}</Text></Container>
    )
  }
  const d = s.destination ?? {}

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-2 px-4 py-4">
          <Link to="/shipments" className="text-ui-fg-subtle flex items-center gap-1 text-sm">
            <ArrowUturnLeft /> {t("zoneRate.shipments.detail.back")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Heading className="font-mono">{s.tracking_number}</Heading>
            <Badge color={STATUS_COLOR[s.status] ?? "grey"}>{statusLabel(info, s.status, l)}</Badge>
            {isLate(s, info) && <Badge color="red">{t("zoneRate.shipments.late")}</Badge>}
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            <Link to={`/orders/${s.order_id}`} className="text-ui-fg-interactive">#{s.order_display_id}</Link> · {s.customer_name ?? s.email}
          </Text>
        </div>

        {/* Next status: big buttons */}
        <div className="flex flex-col gap-3 px-4 py-4">
          <Text size="small" weight="plus">{t("zoneRate.shipments.detail.next")}</Text>
          {nextStatuses.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">{t("zoneRate.shipments.detail.noNext")}</Text>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {nextStatuses.map((ns) => (
                <Button
                  key={ns.id}
                  size="large"
                  variant={next === ns.id ? "primary" : "secondary"}
                  className="w-full justify-center whitespace-normal text-center" style={{ minHeight: 52 }}
                  onClick={() => choose(ns.id)}
                >
                  {ns.label[l]}
                </Button>
              ))}
            </div>
          )}

          {next && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label size="small">{t("zoneRate.shipments.detail.location")}</Label>
                <Input style={{ height: 44 }} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("zoneRate.shipments.detail.locationPh")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">{t("zoneRate.shipments.detail.note")}</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("zoneRate.shipments.detail.notePh")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">{t("zoneRate.shipments.detail.when")}</Label>
                <Input style={{ height: 44 }} type="datetime-local" value={when} max={localInput(new Date())} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label size="small">{t("zoneRate.shipments.detail.photos")} ({photos.length}/{MAX_PHOTOS})</Label>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                      <img src={p.preview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label="remove"
                        className="bg-ui-bg-base absolute right-1 top-1 rounded-full p-1 shadow"
                        onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))}
                      >
                        <XMark />
                      </button>
                    </div>
                  ))}
                </div>
                {photos.length < MAX_PHOTOS && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => addPhotos(e.target.files)}
                    />
                    <Button size="large" variant="secondary" className="w-full" style={{ minHeight: 48 }} isLoading={uploading} onClick={() => fileRef.current?.click()}>
                      <Camera /> {t("zoneRate.shipments.detail.addPhoto")}
                    </Button>
                    <Text size="xsmall" className="text-ui-fg-muted">{t("zoneRate.shipments.detail.photoHint")}</Text>
                  </>
                )}
              </div>
              <label className="flex items-center gap-3" style={{ minHeight: 44 }}>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                <Text size="small">{t("zoneRate.shipments.detail.public")}</Text>
              </label>
              <Button size="large" className="w-full" style={{ minHeight: 52 }} isLoading={save.isPending} disabled={uploading} onClick={() => save.mutate()}>
                {t("zoneRate.shipments.detail.save", { status: statusLabel(info, next, l) })}
              </Button>
            </div>
          )}
        </div>

        {/* Print */}
        <div className="grid grid-cols-2 gap-2 px-4 py-4">
          <Button size="large" variant="secondary" className="w-full" style={{ minHeight: 48 }} onClick={() => print("label")}>
            <DocumentText /> {t("zoneRate.shipments.detail.label")}
          </Button>
          <Button size="large" variant="secondary" className="w-full" style={{ minHeight: 48 }} onClick={() => print("slip")}>
            <DocumentText /> {t("zoneRate.shipments.detail.slip")}
          </Button>
        </div>

        {/* Facts */}
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          <div className="col-span-2">
            <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.detail.destination")}</Text>
            <Text size="small">
              {[d.first_name, d.last_name].filter(Boolean).join(" ")}
              {d.phone ? ` · ${d.phone}` : ""}
              <br />
              {[d.address_1, d.address_2].filter(Boolean).join(", ")}
              <br />
              {[d.city, s.province_name ?? d.province, d.postal_code, d.country_code?.toUpperCase()].filter(Boolean).join(", ")}
            </Text>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.detail.weight")}</Text>
            <Text size="small">
              {s.chargeable_kg ?? "–"} kg · {(config?.configured && config.services.find((x) => x.id === s.service_id)?.name[l]) || s.service_id || "–"}
            </Text>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.detail.shipping")}</Text>
            <Text size="small">{s.shipping_amount != null && s.currency_code ? formatMoney(s.shipping_amount, s.currency_code, l) : "–"}</Text>
          </div>
          {s.estimated_delivery_at && (
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.detail.estimate")}</Text>
              <Text size="small">{formatDateTime(s.estimated_delivery_at, l)}</Text>
            </div>
          )}
          {s.tracking_url && (
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">{t("zoneRate.shipments.detail.trackingPage")}</Text>
              <a href={s.tracking_url} target="_blank" rel="noreferrer" className="text-ui-fg-interactive text-sm">↗ {t("zoneRate.shipments.detail.trackingPage")}</a>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-2 px-4 py-4">
          <Text size="small" weight="plus">{t("zoneRate.shipments.detail.timeline")}</Text>
          <ol className="flex flex-col">
            {(s.events ?? []).map((e, i) => (
              <li key={e.id} className="relative flex gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 h-3 w-3 rounded-full ${i === 0 ? "bg-ui-fg-base" : "bg-ui-border-strong"}`} />
                  {i < (s.events?.length ?? 0) - 1 && <span className="bg-ui-border-base w-px flex-1" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Text size="small" weight="plus">{statusLabel(info, e.status, l)}</Text>
                    {!e.public && <Badge size="2xsmall">{t("zoneRate.shipments.detail.hidden")}</Badge>}
                    {e.notified_at && <Badge size="2xsmall" color="green">{t("zoneRate.shipments.detail.emailed")}</Badge>}
                  </div>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {formatDateTime(e.occurred_at, l)}
                    {e.location ? ` · ${e.location}` : ""}
                    {e.created_by_name ? ` · ${t("zoneRate.shipments.detail.by", { name: e.created_by_name })}` : ""}
                  </Text>
                  {e.note && <Text size="small" className="whitespace-pre-wrap">{e.note}</Text>}
                  {!!e.photo_ids?.length && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {e.photo_ids.map((p) => (
                        <a key={p} href={photoUrl(p)} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border">
                          <img src={photoUrl(p)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Carrier */}
        <div className="flex flex-col gap-2 px-4 py-4">
          <Text size="small" weight="plus">{t("zoneRate.shipments.detail.carrier")}</Text>
          <Input style={{ height: 44 }} placeholder={t("zoneRate.shipments.detail.carrierName")} value={carrier.name} onChange={(e) => setCarrier({ ...carrier, name: e.target.value })} />
          <Input style={{ height: 44 }} placeholder={t("zoneRate.shipments.detail.carrierNumber")} value={carrier.tracking_number} onChange={(e) => setCarrier({ ...carrier, tracking_number: e.target.value })} />
          <Input style={{ height: 44 }} type="url" placeholder={t("zoneRate.shipments.detail.carrierUrl")} value={carrier.tracking_url} onChange={(e) => setCarrier({ ...carrier, tracking_url: e.target.value })} />
          <Button size="large" variant="secondary" isLoading={saveCarrier.isPending} onClick={() => saveCarrier.mutate()}>
            {t("zoneRate.shipments.detail.saveCarrier")}
          </Button>
        </div>
      </Container>
      <CreditFooter />
    </div>
  )
}

export default ShipmentDetailPage
