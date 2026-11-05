import fs from "node:fs"
import path from "node:path"
import type { ConfigModule, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ZoneRateConfig } from "./types"

export const PACKAGE_NAME = "medusa-fulfillment-zone-rate"

/** Options of the plugin entry (`plugins: [{ resolve, options }]`), separate from the provider's rate config */
export type ZoneRatePluginOptions = {
  /** Show the small "by Haus Kayu" credit under the plugin's Admin pages. Default true. */
  showCredit?: boolean
}

type Entry = string | { resolve?: unknown; options?: unknown; providers?: unknown }

function configModule(container: MedusaContainer): ConfigModule {
  return container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
}

function packageNameAt(dir: string): string | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name ?? null
  } catch {
    return null
  }
}

/** A resolve string that points at this package: its name, a sub-path of it, or a local path to it */
export function isThisPackage(resolve: string): boolean {
  const r = resolve.replace(/\/+$/, "")
  if (r === PACKAGE_NAME || r.startsWith(`${PACKAGE_NAME}/`) || r.includes(`/${PACKAGE_NAME}`)) return true
  if (r.startsWith(".") || path.isAbsolute(r)) {
    // "./plugins/zone-rate" or ".../providers/zone-rate" inside a checkout of this package
    for (let dir = path.resolve(r), i = 0; i < 6; i++, dir = path.dirname(dir)) {
      if (packageNameAt(dir) === PACKAGE_NAME) return true
    }
  }
  return false
}

export function getPluginOptions(container: MedusaContainer): ZoneRatePluginOptions {
  for (const p of (configModule(container).plugins ?? []) as Entry[]) {
    const resolve = typeof p === "string" ? p : p.resolve
    if (typeof resolve === "string" && isThisPackage(resolve)) {
      return typeof p === "string" ? {} : ((p.options as ZoneRatePluginOptions) ?? {})
    }
  }
  return {}
}

/**
 * The rate config, as passed to the zone-rate provider of the Fulfillment
 * Module (the provider is the only consumer that prices carts; the Admin reads
 * the same object to show rates and the exchange rate).
 */
export function getProviderConfig(container: MedusaContainer): ZoneRateConfig | null {
  const modules = configModule(container).modules ?? {}
  const entries: Entry[] = Array.isArray(modules) ? modules : Object.values(modules as Record<string, Entry>)
  for (const m of entries) {
    if (!m || typeof m !== "object") continue
    const providers = ((m.options as { providers?: unknown })?.providers ?? m.providers) as Entry[] | undefined
    if (!Array.isArray(providers)) continue
    for (const p of providers) {
      if (p && typeof p === "object" && typeof p.resolve === "string" && isThisPackage(p.resolve)) {
        return (p.options as ZoneRateConfig) ?? null
      }
    }
  }
  return null
}
