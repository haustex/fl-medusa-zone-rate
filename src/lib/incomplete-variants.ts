import type { Knex } from "@medusajs/framework/mikro-orm/knex"

export type IncompleteVariantRow = {
  variant_id: string
  variant_title: string | null
  sku: string | null
  product_id: string
  product_title: string
  product_status: string
  weight: number | null
  length: number | null
  width: number | null
  height: number | null
  missing: ("weight" | "length" | "width" | "height")[]
}

const FIELDS = ["weight", "length", "width", "height"] as const

/**
 * Variants that cannot be priced: weight or a dimension empty (or 0) on the
 * variant and, when `productFallback` is on, on its product too. Filtered in
 * SQL so large catalogs page cheaply.
 */
export async function listIncompleteVariants(
  pg: Knex,
  opts: { productFallback: boolean; limit?: number; offset?: number }
): Promise<{ rows: IncompleteVariantRow[]; count: number }> {
  const value = (f: (typeof FIELDS)[number]) =>
    opts.productFallback ? `coalesce(nullif(v.${f}, 0), nullif(p.${f}, 0))` : `nullif(v.${f}, 0)`
  const missingSql = FIELDS.map((f) => `${value(f)} is null`).join(" or ")

  const base = pg("product_variant as v")
    .join("product as p", "p.id", "v.product_id")
    .whereNull("v.deleted_at")
    .whereNull("p.deleted_at")
    .whereRaw(`(${missingSql})`)

  const [{ count }] = await base.clone().count<{ count: string }[]>({ count: "*" })
  let q = base
    .clone()
    .select(
      "v.id as variant_id",
      "v.title as variant_title",
      "v.sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.status as product_status",
      ...FIELDS.map((f) => pg.raw(`${value(f)} as ${f}`))
    )
    .orderBy([{ column: "p.title" }, { column: "v.title" }])
  if (opts.limit) q = q.limit(opts.limit).offset(opts.offset ?? 0)
  const rows = (await q) as Omit<IncompleteVariantRow, "missing">[]

  return {
    count: Number(count),
    rows: rows.map((r) => {
      const values = Object.fromEntries(FIELDS.map((f) => [f, r[f] === null ? null : Number(r[f])])) as Record<
        (typeof FIELDS)[number],
        number | null
      >
      return { ...r, ...values, missing: FIELDS.filter((f) => values[f] === null) }
    }),
  }
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v)
  // Quote, double inner quotes, and defuse spreadsheet formulas
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
}

export function incompleteVariantsCsv(rows: IncompleteVariantRow[], adminUrl?: string): string {
  const header = ["product", "variant", "sku", "status", "missing", "weight", "length", "width", "height", "product_id", "variant_id", "link"]
  const lines = rows.map((r) =>
    [
      r.product_title,
      r.variant_title,
      r.sku,
      r.product_status,
      r.missing.join(" "),
      r.weight,
      r.length,
      r.width,
      r.height,
      r.product_id,
      r.variant_id,
      adminUrl ? `${adminUrl.replace(/\/$/, "")}/products/${r.product_id}/variants/${r.variant_id}` : "",
    ]
      .map(cell)
      .join(",")
  )
  return [header.join(","), ...lines].join("\r\n") + "\r\n"
}
