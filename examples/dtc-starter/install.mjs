#!/usr/bin/env node
// Adds the tracking pages to the storefront of a Medusa DTC Starter
// (github.com/medusajs/dtc-starter, apps/storefront):
//
//   node node_modules/medusa-fulfillment-zone-rate/examples/dtc-starter/install.mjs <repo>/apps/storefront [--force]
//
// Copies the core (src/storefront of the package) to
// src/modules/zone-rate-tracking/core/ and this example's src/ into the
// storefront. Existing files are kept unless --force; config.ts is never
// overwritten. No starter file is edited: see README.md for the order page.
import fs from "node:fs"
import path from "node:path"

const here = path.dirname(new URL(import.meta.url).pathname)
const pkgRoot = path.resolve(here, "../..")
const [target, ...flags] = process.argv.slice(2)
const force = flags.includes("--force")
if (!target || !fs.existsSync(path.join(target, "src/app"))) {
  console.error("Usage: install.mjs <storefront dir with src/app> [--force]")
  process.exit(1)
}

const copied = []
const kept = []
function copyTree(from, to, { never = [] } = {}) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue
      copyTree(src, dst, { never })
      continue
    }
    if (entry.name === "tsconfig.json") continue
    const rel = path.relative(target, dst)
    if (fs.existsSync(dst) && (!force || never.some((n) => rel.endsWith(n)))) {
      kept.push(rel)
      continue
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
    copied.push(rel)
  }
}

copyTree(path.join(pkgRoot, "src/storefront"), path.join(target, "src/modules/zone-rate-tracking/core"))
copyTree(path.join(here, "src"), path.join(target, "src"), { never: ["modules/zone-rate-tracking/config.ts"] })

console.log(`Copied ${copied.length} files${kept.length ? `, kept ${kept.length} existing (use --force to replace; config.ts is never replaced)` : ""}.`)
for (const f of copied) console.log(`  + ${f}`)
for (const f of kept) console.log(`  = ${f}`)
console.log(`
Next:
  1. Set ZONE_RATE_PROXY_SECRET in the storefront's server env and the same value as
     tracking.trustedProxySecret (or env ZONE_RATE_PROXY_SECRET) in Medusa.
  2. Plugin option tracking.notifications.trackingUrl, e.g. "https://shop.example/us/track/{tracking_number}".
  3. Optional: render <OrderShipments orderId={order.id} countryCode={countryCode} /> on the order page.`)
