// End-to-end check of the provider inside a real Medusa app (integration-tests/app):
// fresh database, migrations, seed, server on port 9500, then the Store and Admin APIs.
//
// Usage (plugin built first with `npm run build`):
//   docker run -d --name zr-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=zr_spike -p 127.0.0.1:55434:5432 postgres:17-alpine
//   node integration-tests/e2e.mjs
//
// Every medusa command goes through scripts/guard.mjs (zr-spike-* containers and ports 9500+ only).
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = path.resolve(HERE, "..")
const APP_DIR = path.join(HERE, "app")
const STATE_DIR = path.join(HERE, ".state")
const GUARD = path.join(PLUGIN_DIR, "scripts/guard.mjs")
const MEDUSA = path.join(PLUGIN_DIR, "node_modules/.bin/medusa")
const DB_NAME = "zr_e2e"
const PORT = 9500
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN = { email: "admin@e2e.test", password: "e2e-password-123" }

const env = {
  ...process.env,
  DATABASE_URL: `postgres://postgres:spike@127.0.0.1:55434/${DB_NAME}`,
  REDIS_URL: "redis://127.0.0.1:56381",
  PORT: String(PORT),
  ZR_PLUGIN_DIR: PLUGIN_DIR,
  NODE_ENV: "development",
}
// REDIS_URL only satisfies the guard; the test app uses the in-memory event bus and workflow engine

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: APP_DIR, env, stdio: "inherit", ...opts })
  if (r.status !== 0) throw new Error(`failed: ${cmd} ${args.join(" ")}`)
}
const guarded = (...args) => run("node", [GUARD, MEDUSA, ...args])

function linkNodeModules() {
  const target = path.join(APP_DIR, "node_modules")
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(path.join(PLUGIN_DIR, "node_modules"))) {
    if ([".package-lock.json", ".cache", ".vite", ".bin"].includes(entry)) continue
    fs.symlinkSync(path.join(PLUGIN_DIR, "node_modules", entry), path.join(target, entry))
  }
  fs.symlinkSync(PLUGIN_DIR, path.join(target, "medusa-fulfillment-zone-rate"))
}

function psql(sql) {
  run("docker", ["exec", "zr-spike-pg", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql])
}

let failures = 0
let passes = 0
function check(name, ok, detail) {
  if (ok) passes++
  else failures++
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || detail === undefined ? "" : `\n      ${JSON.stringify(detail)}`}`)
}

async function api(method, url, { body, headers = {} } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json, headers: res.headers }
}

async function main() {
  if (!fs.existsSync(path.join(PLUGIN_DIR, ".medusa/server/src/providers/zone-rate/index.js"))) {
    throw new Error("Build the plugin first: npm run build")
  }
  fs.mkdirSync(STATE_DIR, { recursive: true })
  linkNodeModules()
  psql(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`)
  psql(`CREATE DATABASE ${DB_NAME}`)
  guarded("db:migrate")
  const seedOut = path.join(STATE_DIR, "seed.json")
  run("node", [GUARD, MEDUSA, "exec", "./src/scripts/seed.ts"], { env: { ...env, ZR_SEED_OUT: seedOut } })
  guarded("user", "-e", ADMIN.email, "-p", ADMIN.password)
  const seed = JSON.parse(fs.readFileSync(seedOut, "utf8"))

  const log = fs.openSync(path.join(STATE_DIR, "server.log"), "w")
  const server = spawn("node", [GUARD, MEDUSA, "start"], { cwd: APP_DIR, env, stdio: ["ignore", log, log], detached: true })
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break
      } catch {}
      if (i > 120) throw new Error("server did not start, see integration-tests/.state/server.log")
      await new Promise((r) => setTimeout(r, 1000))
    }
    await checks(seed)
  } finally {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {}
  }
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}

let seedRef
async function checks(seed) {
  seedRef = seed
  const store = { "x-publishable-api-key": seed.publishable_key }

  const newCart = async (currency, address, variant = "talenan", quantity = 1) => {
    const { json } = await api("POST", "/store/carts", {
      headers: store,
      body: { region_id: seed.regions[currency], shipping_address: address, email: "e2e@example.com" },
    })
    const id = json.cart.id
    const add = await api("POST", `/store/carts/${id}/line-items`, {
      headers: store,
      body: { variant_id: seed.variants[variant], quantity },
    })
    if (add.status !== 200) throw new Error(`add to cart: ${JSON.stringify(add.json)}`)
    return id
  }
  const options = async (cartId) =>
    (await api("GET", `/store/shipping-options?cart_id=${cartId}`, { headers: store })).json.shipping_options ?? []
  const calculate = (cartId, optionId) =>
    api("POST", `/store/shipping-options/${optionId}/calculate`, { headers: store, body: { cart_id: cartId } })

  console.log("\nStore API")
  const jt = await newCart("idr", { country_code: "id", province: "Jawa Tengah", city: "Semarang", address_1: "Jl. A", postal_code: "50111", first_name: "E", last_name: "2E" })
  const idOptions = await options(jt)
  check("ID cart lists one calculated option", idOptions.length === 1 && idOptions[0].price_type === "calculated", idOptions)
  const domestic = idOptions[0]
  let r = await calculate(jt, domestic.id)
  check("Jawa Tengah, 1.2 kg → Rp60.000", r.status === 200 && r.json.shipping_option.amount === 60000, r.json)

  const papua = await newCart("idr", { country_code: "id", province: "ID-PA" }, "talenan", 3)
  r = await calculate(papua, domestic.id)
  check("Papua, 3 × 1.2 kg = 3.6 → 4 kg × Rp250.000", r.status === 200 && r.json.shipping_option.amount === 1000000, r.json)

  const jateng = await newCart("idr", { country_code: "id", province: "jateng" })
  r = await calculate(jateng, domestic.id)
  check("alias 'jateng' prices like Jawa Tengah", r.json.shipping_option?.amount === 60000, r.json)

  const unknown = await newCart("idr", { country_code: "id", province: "Atlantis" })
  r = await calculate(unknown, domestic.id)
  check("unknown province → 4xx with message", r.status >= 400 && r.status < 500 && /Atlantis/.test(r.json.message), r)
  await calculate(unknown, domestic.id)

  const incomplete = await newCart("idr", { country_code: "id", province: "Jawa Tengah" }, "mangkuk")
  r = await calculate(incomplete, domestic.id)
  check("variant without dimensions → refused, names the product", r.status >= 400 && /Mangkuk/.test(r.json.message), r.json)

  const add = await api("POST", `/store/carts/${incomplete}/shipping-methods`, { headers: store, body: { option_id: domestic.id } })
  check("refused option cannot be added to the cart", add.status >= 400, add.json)

  const ok = await api("POST", `/store/carts/${jt}/shipping-methods`, { headers: store, body: { option_id: domestic.id } })
  check(
    "priced option is added with the calculated amount",
    ok.status === 200 && ok.json.cart.shipping_methods?.[0]?.amount === 60000,
    ok.json.cart?.shipping_methods ?? ok.json
  )

  const us = await newCart("usd", { country_code: "us", province: "CA" })
  const usOptions = await options(us)
  check("US cart lists Air + Sea", usOptions.map((o) => o.name).sort().join() === "Air Freight,Sea Freight", usOptions.map((o) => o.name))
  const air = usOptions.find((o) => o.name === "Air Freight")
  const sea = usOptions.find((o) => o.name === "Sea Freight")
  r = await calculate(us, air.id)
  check("Air 2 kg × Rp1.285.000 / 16.500 → $156", r.json.shipping_option?.amount === 156, r.json)
  r = await calculate(us, sea.id)
  check("Sea 2 kg × Rp250.000 / 16.500 → $31", r.json.shipping_option?.amount === 31, r.json)

  console.log("\nAdmin API")
  const auth = await api("POST", "/auth/user/emailpass", { body: ADMIN })
  const admin = { authorization: `Bearer ${auth.json.token}` }
  r = await api("GET", "/admin/zone-rate/rejections", { headers: admin })
  const reasons = (r.json.rejections ?? []).map((x) => x.reason).sort()
  check("rejections logged (province + variant)", r.status === 200 && reasons.includes("unknown_province") && reasons.includes("incomplete_items"), r.json)
  const province = r.json.rejections?.find((x) => x.reason === "unknown_province")
  check("repeat for the same cart counted on one row", province?.count === 2 && province?.raw_province === "Atlantis", province)
  const variant = r.json.rejections?.find((x) => x.reason === "incomplete_items")
  check(
    "variant rejection lists the variant and missing fields",
    variant?.variants?.[0]?.variant_id === seed.variants.mangkuk && variant.variants[0].missing.join() === "length,width,height",
    variant
  )

  r = await api("GET", "/admin/zone-rate/incomplete-variants", { headers: admin })
  check(
    "incomplete-variants report lists Mangkuk only",
    r.status === 200 && r.json.count === 1 && r.json.variants[0].product_title === "Mangkuk",
    r.json
  )
  r = await api("GET", "/admin/zone-rate/incomplete-variants?format=csv", { headers: admin })
  check(
    "CSV export",
    r.status === 200 && /text\/csv/.test(r.headers.get("content-type")) && /Mangkuk/.test(r.json) && /attachment/.test(r.headers.get("content-disposition")),
    String(r.json).slice(0, 200)
  )
  r = await api("GET", "/admin/zone-rate/config", { headers: admin })
  check(
    "config: 3 services, USD rate and date, credit on",
    r.json.configured && r.json.services.length === 3 && r.json.exchange_rates.usd.updated_at === "2026-11-03" && r.json.show_credit === true,
    r.json
  )
  r = await api("GET", "/admin/zone-rate/rejections")
  check("admin routes need a login", r.status === 401, r.status)
  r = await api("GET", "/admin/fulfillment-providers", { headers: admin })
  check("provider registered as zone-rate_zone-rate", JSON.stringify(r.json).includes("zone-rate_zone-rate"), r.json)

  await trackingChecks({ seed, store, admin, jt, domestic })
}

async function placeOrder(store, cartId) {
  const pc = await api("POST", "/store/payment-collections", { headers: store, body: { cart_id: cartId } })
  await api("POST", `/store/payment-collections/${pc.json.payment_collection.id}/payment-sessions`, {
    headers: store,
    body: { provider_id: "pp_system_default" },
  })
  const done = await api("POST", `/store/carts/${cartId}/complete`, { headers: store })
  if (done.json.type !== "order") throw new Error(`complete cart: ${JSON.stringify(done.json)}`)
  return done.json.order
}

async function waitFor(fn, ms = 10000) {
  const until = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > until) return null
    await new Promise((r) => setTimeout(r, 300))
  }
}

async function trackingChecks({ store, admin, jt }) {
  console.log("\nTracking")
  const order = await placeOrder(store, jt)
  check("order placed with the zone-rate method", order.shipping_methods?.[0]?.amount === 60000, order.shipping_methods)

  const shipment = await waitFor(async () => {
    const r = await api("GET", `/admin/zone-rate/orders/${order.id}/shipments`, { headers: admin })
    return r.json.shipments?.[0]
  })
  check("shipment created on order.placed", !!shipment, shipment)
  if (!shipment) return
  check("tracking number HK-YYMMDD-XXXXXC", /^HK-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/.test(shipment.tracking_number), shipment.tracking_number)
  check(
    "snapshot: status diproses, zone jawa, 2 kg, Rp60.000, Semarang",
    shipment.status === "diproses" && shipment.zone_id === "jawa" && shipment.chargeable_kg === 2 && shipment.shipping_amount === 60000 && shipment.destination?.city === "Semarang",
    shipment
  )

  const status = (id, body) => api("POST", `/admin/zone-rate/shipments/${id}/status`, { headers: admin, body })
  let r = await status(shipment.id, { status: "terkirim" })
  check("invalid transition diproses → terkirim refused", r.status === 400 && /cannot go from/.test(r.json.message), r)

  // Live stream: opened before the updates
  const ac = new AbortController()
  const received = []
  const streamed = (async () => {
    const res = await fetch(`${BASE}/store/zone-rate/track/${shipment.tracking_number}/stream`, { headers: store, signal: ac.signal })
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value)
        for (const m of buf.matchAll(/event: update\ndata: (.*)\n\n/g)) received.push(JSON.parse(m[1]))
        buf = buf.slice(buf.lastIndexOf("\n\n") + 2)
      }
    } catch {}
  })()
  await new Promise((r) => setTimeout(r, 500))

  r = await status(shipment.id, { status: "dikemas", note: "dibungkus bubble wrap", public: true })
  check("diproses → dikemas", r.status === 200 && r.json.shipment.status === "dikemas", r.json)

  r = await status(shipment.id, { status: "dikirim", location: "Jepara", note: "internal: kurir Pak Budi, 0812", public: true })
  check("dikemas → dikirim", r.status === 200 && r.json.shipment.shipped_at && r.json.shipment.estimated_delivery_at, r.json)
  const ord = await api("GET", `/admin/orders/${order.id}?fields=fulfillment_status,fulfillments.shipped_at,fulfillments.labels.tracking_number`, { headers: admin })
  const f = ord.json.order?.fulfillments?.[0]
  check(
    "Medusa: fulfillment created and shipped, label = our tracking number",
    ord.json.order?.fulfillment_status === "shipped" && f?.shipped_at && f?.labels?.[0]?.tracking_number === shipment.tracking_number,
    ord.json.order
  )

  r = await status(shipment.id, { status: "transit", location: "Semarang", public: false })
  check("hidden event recorded", r.status === 200 && r.json.event.public === false, r.json)

  const seen = await waitFor(() => received.length >= 2 && received, 5000)
  check(
    "SSE pushes public updates only (dikemas, dikirim; not the hidden transit)",
    !!seen && received.map((u) => u.status).join() === "dikemas,dikirim",
    received
  )
  ac.abort()
  await streamed

  r = await api("GET", `/store/zone-rate/track/${shipment.tracking_number.toLowerCase().replace(/-/g, " ")}`, { headers: store })
  const pub = r.json.shipment
  const text = JSON.stringify(pub)
  check("public lookup (lower case, spaces) works", r.status === 200 && pub?.status === "transit", r.json)
  check(
    "public view: city/province only, no name, street, phone or notes",
    pub && pub.destination.city === "Semarang" && !/Jl\. A|50111|Pak Budi|bubble|first_name|E2E/.test(text) && pub.events.length === 3,
    pub
  )
  r = await api("GET", `/store/zone-rate/track/${shipment.tracking_number.slice(0, -1)}X`, { headers: store })
  check("wrong check symbol → 404", r.status === 404, r.status)

  // Photo
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  r = await api("POST", `/admin/zone-rate/shipments/${shipment.id}/photos`, { headers: admin, body: { data_url: png } })
  const photo = r.json.photo
  check("photo upload stored as WebP", r.status === 200 && photo?.mime_type === "image/webp", r.json)
  r = await api("POST", `/admin/zone-rate/shipments/${shipment.id}/photos`, { headers: admin, body: { data_url: "data:image/png;base64,PHNjcmlwdD4=" } })
  check("non-image refused", r.status === 400, r.status)
  const img = await fetch(`${BASE}/admin/zone-rate/photos/${photo?.id}`, { headers: admin })
  check("photo served to admins with nosniff", img.status === 200 && img.headers.get("x-content-type-options") === "nosniff", img.status)

  r = await status(shipment.id, { status: "terkirim", photo_ids: Array(6).fill(photo?.id) })
  check("more than 5 photos per update refused", r.status === 400, r.status)
  r = await status(shipment.id, { status: "terkirim", location: "Semarang", photo_ids: [photo?.id], public: true })
  check("transit → terkirim", r.status === 200 && r.json.shipment.delivered_at, r.json)
  const ord2 = await api("GET", `/admin/orders/${order.id}?fields=fulfillment_status`, { headers: admin })
  check("Medusa: order delivered", ord2.json.order?.fulfillment_status === "delivered", ord2.json.order)
  r = await status(shipment.id, { status: "transit" })
  check("final status: no more transitions", r.status === 400, r.status)

  r = await api("GET", `/admin/zone-rate/shipments/${shipment.id}`, { headers: admin })
  check(
    "timeline append-only: 5 events, actor recorded",
    r.json.shipment?.events?.length === 5 && r.json.shipment.events.every((e) => e.created_by_name || e.status === "diproses"),
    r.json.shipment?.events?.map((e) => [e.status, e.created_by_name])
  )

  // E-mails (notification-local): one per public event, none for the hidden one
  const notes = await waitFor(async () => {
    const n = await api("GET", "/admin/notifications?limit=50&fields=id,to,template,data,channel", { headers: admin })
    const mine = (n.json.notifications ?? []).filter((x) => x.data?.tracking_number === shipment.tracking_number)
    return mine.length >= 4 && mine
  })
  check(
    "e-mails for public statuses (diproses, dikemas, dikirim, terkirim), not the hidden transit",
    !!notes && notes.map((n) => n.data.status).sort().join() === "dikemas,dikirim,diproses,terkirim" && notes[0].to === "e2e@example.com",
    notes
  )

  // Customer view needs a login
  r = await api("GET", `/store/zone-rate/orders/${order.id}/shipments`, { headers: store })
  check("order shipments need a customer login", r.status === 401, r.status)

  // Summary, list filters, bulk update on a second order
  const cart2 = await (async () => {
    const { json } = await api("POST", "/store/carts", {
      headers: store,
      body: { region_id: seedRef.regions.idr, email: "bulk@example.com", shipping_address: { country_code: "id", province: "Bali", city: "Denpasar", address_1: "Jl. B", first_name: "Bulk", last_name: "Buyer" } },
    })
    await api("POST", `/store/carts/${json.cart.id}/line-items`, { headers: store, body: { variant_id: seedRef.variants.talenan, quantity: 1 } })
    const opts = (await api("GET", `/store/shipping-options?cart_id=${json.cart.id}`, { headers: store })).json.shipping_options
    await api("POST", `/store/carts/${json.cart.id}/shipping-methods`, { headers: store, body: { option_id: opts[0].id } })
    return json.cart.id
  })()
  const order2 = await placeOrder(store, cart2)
  const s2 = await waitFor(async () => (await api("GET", `/admin/zone-rate/orders/${order2.id}/shipments`, { headers: admin })).json.shipments?.[0])
  r = await api("POST", "/admin/zone-rate/shipments/bulk-status", { headers: admin, body: { ids: [s2.id, shipment.id], status: "dikemas" } })
  check("bulk update: valid one updated, delivered one refused", r.json.updated === 1 && r.json.failed === 1, r.json)
  r = await api("GET", "/admin/zone-rate/shipments?q=bulk&status=dikemas", { headers: admin })
  check("list: search + status filter", r.json.count === 1 && r.json.shipments[0].zone_id === "bali", r.json)
  r = await api("GET", `/admin/zone-rate/shipments?q=%23${order2.display_id}`, { headers: admin })
  check("list: search by #order number", r.json.count === 1, r.json.count)
  r = await api("GET", "/admin/zone-rate/shipments/summary", { headers: admin })
  check("summary: per status + shipped today", r.json.by_status?.terkirim === 1 && r.json.by_status?.dikemas === 1 && r.json.shipped_today === 1, r.json)

  // Rate limit (40/min in the test app)
  let limited = false
  for (let i = 0; i < 45 && !limited; i++) {
    limited = (await api("GET", `/store/zone-rate/track/HK-000000-000000`, { headers: store })).status === 429
  }
  check("public lookups are rate limited per IP", limited, limited)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
