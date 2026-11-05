import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261103084215 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "zone_rate_shipment" drop constraint if exists "zone_rate_shipment_tracking_number_unique";`);
    this.addSql(`create table if not exists "zone_rate_shipment" ("id" text not null, "order_id" text not null, "order_display_id" integer null, "email" text null, "customer_name" text null, "fulfillment_id" text null, "service_id" text null, "zone_id" text null, "tracking_number" text not null, "carrier_name" text null, "carrier_tracking_number" text null, "carrier_tracking_url" text null, "chargeable_kg" integer null, "shipping_amount" integer null, "currency_code" text null, "destination" jsonb null, "estimate" jsonb null, "status" text not null, "status_at" timestamptz not null, "shipped_at" timestamptz null, "estimated_delivery_at" timestamptz null, "delivered_at" timestamptz null, "locale" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "zone_rate_shipment_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_tracking_number_unique" ON "zone_rate_shipment" ("tracking_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_deleted_at" ON "zone_rate_shipment" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_order_id" ON "zone_rate_shipment" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_status" ON "zone_rate_shipment" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_carrier_tracking_number" ON "zone_rate_shipment" ("carrier_tracking_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_status_at" ON "zone_rate_shipment" ("status_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "zone_rate_shipment_event" ("id" text not null, "status" text not null, "previous_status" text null, "note" text null, "location" text null, "occurred_at" timestamptz not null, "created_by" text null, "created_by_name" text null, "public" boolean not null default true, "photo_ids" jsonb null, "notified_at" timestamptz null, "shipment_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "zone_rate_shipment_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_event_shipment_id" ON "zone_rate_shipment_event" ("shipment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_event_deleted_at" ON "zone_rate_shipment_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_event_occurred_at" ON "zone_rate_shipment_event" ("occurred_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "zone_rate_shipment_photo" ("id" text not null, "shipment_id" text not null, "mime_type" text not null, "size" integer not null, "data" text not null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "zone_rate_shipment_photo_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_photo_deleted_at" ON "zone_rate_shipment_photo" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_shipment_photo_shipment_id" ON "zone_rate_shipment_photo" ("shipment_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "zone_rate_shipment_event" add constraint "zone_rate_shipment_event_shipment_id_foreign" foreign key ("shipment_id") references "zone_rate_shipment" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "zone_rate_shipment_event" drop constraint if exists "zone_rate_shipment_event_shipment_id_foreign";`);

    this.addSql(`drop table if exists "zone_rate_shipment" cascade;`);

    this.addSql(`drop table if exists "zone_rate_shipment_event" cascade;`);

    this.addSql(`drop table if exists "zone_rate_shipment_photo" cascade;`);
  }

}
