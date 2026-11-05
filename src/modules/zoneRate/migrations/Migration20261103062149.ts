import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261103062149 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "zone_rate_rejection" ("id" text not null, "cart_id" text null, "service_id" text not null, "reason" text not null, "raw_province" text null, "country_code" text null, "variants" jsonb null, "message" text not null, "signature" text not null, "count" integer not null default 1, "last_seen_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "zone_rate_rejection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_rejection_deleted_at" ON "zone_rate_rejection" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_rejection_cart_id_signature" ON "zone_rate_rejection" ("cart_id", "signature") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_rejection_last_seen_at" ON "zone_rate_rejection" ("last_seen_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_zone_rate_rejection_reason" ON "zone_rate_rejection" ("reason") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "zone_rate_rejection" cascade;`);
  }

}
