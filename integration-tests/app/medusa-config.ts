import path from "node:path"
import { defineConfig } from "@medusajs/framework/utils"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shipping = require(path.resolve(__dirname, "../../examples/shipping.config.haus-kayu")).default

// Test app for the E2E suite. Only started through scripts/guard.mjs, which on
// the Haus Kayu host allows nothing but the zr-spike-* containers and ports 9500+.
const pluginDir = process.env.ZR_PLUGIN_DIR || path.resolve(__dirname, "../..")

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    workerMode: "shared",
    http: {
      storeCors: "*",
      adminCors: "*",
      authCors: "*",
      jwtSecret: "zr-e2e-jwt",
      cookieSecret: "zr-e2e-cookie",
    },
  },
  admin: { disable: process.env.ZR_ADMIN !== "1", backendUrl: "/" },
  plugins: [
    {
      resolve: pluginDir,
      options: {
        showCredit: true,
        tracking: {
          // The test app has no payment capture, so shipments start at order.placed
          autoCreate: "order.placed",
          lookupsPerIpPerMinute: 40,
          notifications: {
            storeName: "Toko Tes",
            trackingUrl: { id: "http://localhost:9510/lacak/{tracking_number}", en: "http://localhost:9510/us/track/{tracking_number}" },
          },
        },
      },
    },
  ],
  modules: [
    {
      // Logs e-mails instead of sending them; rows land in the notification table
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [{ resolve: "@medusajs/medusa/notification-local", id: "local", options: { channels: ["email"] } }],
      },
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
          {
            resolve: path.join(pluginDir, ".medusa/server/src/providers/zone-rate"),
            id: "zone-rate",
            options: { ...shipping, exchange_rates: { usd: { rate: 16500, updated_at: "2026-11-03" } } },
          },
        ],
      },
    },
  ],
})
