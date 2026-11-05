import type { Shipment, TrackingInfo } from "./api"
import { shipmentQr, statusLabel } from "./api"
import { code128Svg } from "./code128"

type L = "en" | "id"

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const T = {
  en: { from: "From", to: "To", order: "Order", weight: "Weight", service: "Service", scan: "Scan to track", slip: "Packing slip", product: "Product", variant: "Variant", qty: "Qty", sku: "SKU", checked: "Packed by", date: "Date", tracking: "Tracking number", status: "Status" },
  id: { from: "Dari", to: "Kepada", order: "Pesanan", weight: "Berat", service: "Layanan", scan: "Pindai untuk lacak", slip: "Packing slip", product: "Produk", variant: "Varian", qty: "Jml", sku: "SKU", checked: "Dikemas oleh", date: "Tanggal", tracking: "Nomor resi", status: "Status" },
}

function recipient(s: Shipment) {
  const d = s.destination ?? {}
  return [
    [d.first_name, d.last_name].filter(Boolean).join(" "),
    d.company,
    d.phone,
    d.address_1,
    d.address_2,
    [d.city, s.province_name ?? d.province].filter(Boolean).join(", "),
    [d.postal_code, d.country_code?.toUpperCase()].filter(Boolean).join(" "),
  ].filter((x) => x && String(x).trim())
}

const BASE_CSS = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#000}
.muted{color:#444}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
@media screen{body{background:#eee}.page{margin:16px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2)}}
`

/** A6 (105 × 148 mm) shipping label: sender, recipient, tracking number with Code 128 and a QR to the tracking page */
export async function labelHtml(s: Shipment, info: TrackingInfo | undefined, l: L, serviceName?: string | null): Promise<string> {
  const t = T[l]
  // Rendered on the server (sanitized SVG from the qrcode package)
  const qr = await shipmentQr(s.id).then((r) => r.svg).catch(() => "")
  const sender = info?.sender
  const service = esc(serviceName ?? s.service_id ?? "–")
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.tracking_number)}</title><style>${BASE_CSS}
@page{size:105mm 148mm;margin:0}
.page{width:105mm;height:148mm;padding:5mm;display:flex;flex-direction:column;gap:3mm;overflow:hidden}
.box{border:0.4mm solid #000;border-radius:1.5mm;padding:2.5mm 3mm}
.lbl{font-size:7pt;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
.from{font-size:8pt;line-height:1.3}.to{font-size:11pt;line-height:1.35;flex:1}
.to .name{font-size:14pt;font-weight:700}
.meta{display:flex;justify-content:space-between;font-size:8.5pt;gap:2mm}
.meta b{display:block;font-size:10pt}
.code{text-align:center}.code svg.bar{width:100%;height:16mm}
.num{font-size:15pt;font-weight:800;letter-spacing:.06em}
.bottom{display:flex;gap:3mm;align-items:center}.qr{width:20mm;height:20mm;flex:none}.qr svg{width:100%;height:100%}
</style></head><body><div class="page">
<div class="box from"><div class="lbl">${t.from}</div><b>${esc(sender?.name)}</b><br>${(sender?.lines ?? []).map(esc).join("<br>")}${sender?.phone ? `<br>${esc(sender.phone)}` : ""}</div>
<div class="box to"><div class="lbl">${t.to}</div><div class="name">${esc(recipient(s)[0])}</div>${recipient(s).slice(1).map(esc).join("<br>")}</div>
<div class="meta"><div>${t.order}<b>#${esc(s.order_display_id ?? "")}</b></div><div>${t.service}<b>${service}</b></div><div>${t.weight}<b>${s.chargeable_kg ?? "–"} kg</b></div></div>
<div class="code">${code128Svg(s.tracking_number, { height: 60, module: 2 }).replace("<svg ", '<svg class="bar" preserveAspectRatio="none" ')}<div class="num mono">${esc(s.tracking_number)}</div></div>
<div class="bottom"><div class="qr">${qr}</div><div class="muted" style="font-size:8pt">${t.scan}<br>${esc(s.tracking_url ?? "")}${s.carrier_name ? `<br>${esc(s.carrier_name)} ${esc(s.carrier_tracking_number ?? "")}` : ""}</div></div>
</div></body></html>`
}

/** A5 packing slip: items to put in the box, recipient, tracking number */
export function packingSlipHtml(s: Shipment, info: TrackingInfo | undefined, l: L): string {
  const t = T[l]
  const items = s.order?.items ?? []
  return `<!doctype html><html><head><meta charset="utf-8"><title>${t.slip} #${esc(s.order_display_id)}</title><style>${BASE_CSS}
@page{size:A5;margin:10mm}
.page{width:148mm;min-height:210mm;padding:10mm}
h1{font-size:16pt;margin:0 0 2mm}.row{display:flex;justify-content:space-between;gap:6mm;font-size:9.5pt;line-height:1.4}
table{width:100%;border-collapse:collapse;margin-top:6mm;font-size:10pt}th,td{text-align:left;padding:2mm 1.5mm;border-bottom:0.3mm solid #999;vertical-align:top}
th{font-size:8pt;text-transform:uppercase;letter-spacing:.06em}td.q,th.q{text-align:right;width:14mm}td.c{width:8mm}
.sign{margin-top:12mm;font-size:9pt}.code svg{height:12mm;width:60mm}
</style></head><body><div class="page">
<div class="row"><div><h1>${t.slip}</h1><div class="muted">${esc(info?.sender?.name)}</div></div>
<div style="text-align:right">${t.order} <b>#${esc(s.order_display_id)}</b><br>${t.date}: ${esc(new Date(s.order?.created_at ?? s.created_at).toLocaleDateString(l === "id" ? "id-ID" : "en-US"))}<br>${t.status}: ${esc(statusLabel(info, s.status, l))}</div></div>
<div class="row" style="margin-top:6mm"><div><b>${t.to}</b><br>${recipient(s).map(esc).join("<br>")}</div>
<div class="code" style="text-align:right"><b>${t.tracking}</b><br>${code128Svg(s.tracking_number, { height: 40, module: 1 })}<div class="mono">${esc(s.tracking_number)}</div></div></div>
<table><thead><tr><th class="c"></th><th>${t.product}</th><th>${t.variant}</th><th>${t.sku}</th><th class="q">${t.qty}</th></tr></thead><tbody>
${items.map((i) => `<tr><td class="c">☐</td><td>${esc(i.title)}</td><td>${esc(i.variant_title ?? "")}</td><td class="mono">${esc(i.sku ?? "")}</td><td class="q">${esc(i.quantity)}</td></tr>`).join("")}
</tbody></table>
<div class="sign">${t.checked}: ______________________ &nbsp; ${t.date}: ____________</div>
</div></body></html>`
}

/** Opens the document in a new tab and starts printing once it has rendered */
export function printHtml(html: string) {
  const w = window.open("", "_blank")
  if (!w) return false
  w.document.open()
  w.document.write(html.replace("</body>", `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),200))</script></body>`))
  w.document.close()
  return true
}
