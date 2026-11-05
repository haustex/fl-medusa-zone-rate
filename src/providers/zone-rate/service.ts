import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentOption,
  Logger,
} from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService, ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { localize, resolveConfig, type ResolvedConfig } from "../../lib/config"
import { quote } from "../../lib/quote"
import { recordRejection } from "../../lib/rejection-log"
import type { QuoteItem, ZoneRateConfig } from "../../lib/types"

type InjectedDependencies = {
  logger: Logger
  [ContainerRegistrationKeys.PG_CONNECTION]?: Knex
}

type CartContext = CalculateShippingOptionPriceDTO["context"]
type CartItem = CartContext["items"][number] & {
  product?: { id?: string; weight?: number | null } | null
}

/**
 * Calculated shipping by zone and chargeable weight. Each service of the
 * config is one fulfillment option; the shipping option's `data.id` names the
 * service. Prices come only from the config passed as provider options.
 */
export default class ZoneRateProviderService extends AbstractFulfillmentProviderService {
  static identifier = "zone-rate"

  protected readonly config_: ResolvedConfig
  protected readonly logger_: Logger
  protected readonly pg_?: Knex

  constructor(container: InjectedDependencies, options: ZoneRateConfig) {
    super()
    this.logger_ = container.logger
    this.config_ = resolveConfig(options)
    try {
      this.pg_ = container[ContainerRegistrationKeys.PG_CONNECTION]
    } catch {
      this.pg_ = undefined
    }
  }

  static validateOptions(options: Record<string, unknown>): void {
    resolveConfig(options as unknown as ZoneRateConfig)
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [...this.config_.services.values()].map((s) => ({
      id: s.id,
      name: localize(s.name, "en"),
      service_id: s.id,
      destination: s.destination,
      estimate: s.estimate ?? null,
    }))
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return typeof data.id === "string" && this.config_.services.has(data.id)
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!(await this.validateOption(optionData))) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Unknown zone-rate service")
    }
    return data
  }

  async canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return this.validateOption((data.data ?? {}) as Record<string, unknown>)
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const serviceId = String((optionData as Record<string, unknown>)?.id ?? "")
    const items = await this.toQuoteItems((context.items ?? []) as CartItem[])
    const address = context.shipping_address
    const result = quote(this.config_, {
      service_id: serviceId,
      currency_code: String(context.currency_code ?? (context as Record<string, unknown>).region?.["currency_code"] ?? ""),
      country_code: address?.country_code ?? null,
      province: address?.province ?? null,
      locale: ((context as Record<string, unknown>).locale as string | undefined) ?? null,
      items,
    })

    if (!result.ok) {
      // Not worth a log row: the buyer simply has not entered an address yet
      const noAddressYet =
        result.reason === "no_address" ||
        result.reason === "no_items" ||
        (result.reason === "unknown_province" && !result.raw_province && !address?.address_1)
      if (!noAddressYet) await recordRejection(this.pg_, this.logger_, {
        cart_id: context.id ?? null,
        rejection: result,
        })
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, result.message)
    }

    return {
      calculated_amount: result.amount,
      // Rates in the config are what the buyer pays; tax is not added on top.
      is_calculated_price_tax_inclusive: true,
    }
  }

  async createFulfillment(): Promise<CreateFulfillmentResult> {
    // Shipment records and tracking numbers are handled by the plugin's
    // tracking module; the Medusa fulfillment only keeps the defaults.
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  /** Cart lines → calculator input; product dimensions are read only when a variant lacks its own. */
  protected async toQuoteItems(items: CartItem[]): Promise<QuoteItem[]> {
    const lines = items.filter((i) => i.requires_shipping !== false)
    const out: QuoteItem[] = lines.map((i) => {
      const v = (i.variant ?? {}) as Partial<CartItem["variant"]>
      return {
        variant_id: String(i.variant_id ?? v.id ?? i.id),
        product_id: (i.product_id as string | undefined) ?? v.product?.id ?? i.product?.id ?? null,
        title: [i.product_title ?? i.title, i.variant_title].filter(Boolean).join(" — ") || null,
        quantity: Number(i.quantity),
        weight: v.weight ?? null,
        length: v.length ?? null,
        width: v.width ?? null,
        height: v.height ?? null,
        product_weight: i.product?.weight ?? null,
      }
    })

    if (!this.config_.product_fallback || !this.pg_) return out
    const needsProduct = out.filter((q) => q.product_id && (!q.length || !q.width || !q.height || !q.weight))
    if (!needsProduct.length) return out
    try {
      const rows: { id: string; weight: number | null; length: number | null; width: number | null; height: number | null }[] =
        await this.pg_("product")
          .select("id", "weight", "length", "width", "height")
          .whereIn("id", [...new Set(needsProduct.map((q) => q.product_id as string))])
          .whereNull("deleted_at")
      const byId = new Map(rows.map((r) => [r.id, r]))
      for (const q of needsProduct) {
        const p = byId.get(q.product_id as string)
        if (!p) continue
        q.product_weight = num(p.weight) ?? q.product_weight
        q.product_length = num(p.length)
        q.product_width = num(p.width)
        q.product_height = num(p.height)
      }
    } catch (e) {
      this.logger_.warn(`[zone-rate] product fallback lookup failed: ${(e as Error).message}`)
    }
    return out
  }
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) ? n : null
}
