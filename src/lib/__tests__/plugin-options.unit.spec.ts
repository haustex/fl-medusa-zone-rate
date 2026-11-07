import type { MedusaContainer } from "@medusajs/framework/types"
import { getBrandLogoUrl, getPluginOptions } from "../plugin-options"

const container = (options: unknown) =>
  ({ resolve: () => ({ plugins: [{ resolve: "medusa-fulfillment-zone-rate", options }] }) }) as unknown as MedusaContainer

describe("plugin options", () => {
  it("reads the options of this plugin's entry", () => {
    expect(getPluginOptions(container({ showCredit: false })).showCredit).toBe(false)
    expect(getPluginOptions({ resolve: () => ({ plugins: ["other-plugin"] }) } as unknown as MedusaContainer)).toEqual({})
  })

  it("brand.logoUrl: absolute http(s) only, default none", () => {
    expect(getBrandLogoUrl(container({}))).toBeNull()
    expect(getBrandLogoUrl(container({ brand: {} }))).toBeNull()
    expect(getBrandLogoUrl(container({ brand: { logoUrl: "  " } }))).toBeNull()
    expect(getBrandLogoUrl(container({ brand: { logoUrl: "https://shop.example/brand/logo.png" } }))).toBe("https://shop.example/brand/logo.png")
    expect(getBrandLogoUrl(container({ brand: { logoUrl: " http://localhost:8000/logo.svg " } }))).toBe("http://localhost:8000/logo.svg")
    // never another scheme or a relative path in a printed document
    expect(getBrandLogoUrl(container({ brand: { logoUrl: "javascript:alert(1)" } }))).toBeNull()
    expect(getBrandLogoUrl(container({ brand: { logoUrl: "data:image/png;base64,AAAA" } }))).toBeNull()
    expect(getBrandLogoUrl(container({ brand: { logoUrl: "/brand/logo.png" } }))).toBeNull()
    expect(getBrandLogoUrl(container({ brand: { logoUrl: "https://shop.example/a b.png" } }))).toBeNull()
  })
})
