import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { incompleteVariantsCsv, listIncompleteVariants } from "../../../../lib/incomplete-variants"
import { getProviderConfig } from "../../../../lib/plugin-options"

/** Variants missing weight or a dimension. `?format=csv` downloads every row. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pg: Knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const productFallback = getProviderConfig(req.scope)?.product_fallback ?? true
  const csv = req.query.format === "csv"
  const limit = csv ? undefined : Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
  const offset = csv ? 0 : Math.max(Number(req.query.offset) || 0, 0)
  const { rows, count } = await listIncompleteVariants(pg, { productFallback, limit, offset })

  if (csv) {
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="incomplete-variants-${date}.csv"`)
    res.setHeader("Cache-Control", "no-store")
    res.send("﻿" + incompleteVariantsCsv(rows, typeof req.query.admin_url === "string" ? req.query.admin_url : undefined))
    return
  }
  res.json({ variants: rows, count, limit, offset, product_fallback: productFallback })
}
