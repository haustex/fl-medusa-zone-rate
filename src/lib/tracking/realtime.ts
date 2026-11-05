import { EventEmitter } from "node:events"
import type { Logger } from "@medusajs/framework/types"

/**
 * Live shipment updates for the SSE streams (Admin list, buyer tracking page).
 *
 * Status updates are published here by the process that made them. With Redis
 * configured (projectConfig.redisUrl), they also go through a Redis pub/sub
 * channel, so every server instance pushes them to its own open streams; one
 * subscriber connection per process, whatever the number of viewers. Without
 * Redis only the local process is notified, and clients fall back to polling.
 */

export const REDIS_CHANNEL = "zone-rate:shipment-updates"

export type ShipmentUpdate = {
  shipment_id: string
  tracking_number: string
  order_id: string
  status: string
  previous_status: string | null
  event_id: string
  public: boolean
  at: string
}

type RedisLike = {
  publish(channel: string, message: string): Promise<unknown>
  subscribe(channel: string): Promise<unknown>
  on(event: "message", cb: (channel: string, message: string) => void): unknown
  on(event: "error", cb: (e: Error) => void): unknown
}

class Hub {
  private emitter = new EventEmitter()
  private pub: RedisLike | null = null
  private started = false
  private readonly origin = `${process.pid}-${Math.random().toString(36).slice(2)}`

  constructor() {
    this.emitter.setMaxListeners(0)
  }

  /** Connects to Redis once (if a URL is given and ioredis is installed) */
  start(redisUrl: string | null | undefined, logger?: Logger) {
    if (this.started) return
    this.started = true
    if (!redisUrl) return
    try {
      // ioredis ships with Medusa's Redis modules; optional here
      const Redis = require("ioredis")
      const opts = { lazyConnect: false, maxRetriesPerRequest: null as null }
      this.pub = new Redis(redisUrl, opts) as RedisLike
      const sub = new Redis(redisUrl, opts) as RedisLike
      sub.on("error", (e) => logger?.warn(`[zone-rate] realtime subscriber: ${e.message}`))
      this.pub.on("error", (e) => logger?.warn(`[zone-rate] realtime publisher: ${e.message}`))
      void sub.subscribe(REDIS_CHANNEL)
      sub.on("message", (_c, message) => {
        try {
          const { origin, update } = JSON.parse(message) as { origin: string; update: ShipmentUpdate }
          if (origin !== this.origin) this.emitter.emit("update", update)
        } catch {
          /* ignore malformed */
        }
      })
    } catch (e) {
      logger?.info(`[zone-rate] realtime without Redis (${(e as Error).message}); clients poll every 30 s`)
    }
  }

  publish(update: ShipmentUpdate) {
    this.emitter.emit("update", update)
    if (this.pub) void this.pub.publish(REDIS_CHANNEL, JSON.stringify({ origin: this.origin, update })).catch(() => {})
  }

  subscribe(listener: (u: ShipmentUpdate) => void): () => void {
    this.emitter.on("update", listener)
    return () => this.emitter.off("update", listener)
  }

  listenerCount() {
    return this.emitter.listenerCount("update")
  }
}

export const shipmentHub = new Hub()
