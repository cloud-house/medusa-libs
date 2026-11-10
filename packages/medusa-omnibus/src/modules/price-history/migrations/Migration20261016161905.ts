import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261016161905 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "price_snapshot" ("id" text not null, "variant_id" text not null, "region_id" text not null, "currency_code" text not null, "amount" real not null, "original_amount" real not null, "recorded_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "price_snapshot_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_price_snapshot_deleted_at" ON "price_snapshot" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_price_snapshot_variant_id_region_id_recorded_at" ON "price_snapshot" ("variant_id", "region_id", "recorded_at") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "price_snapshot" cascade;`)
  }
}
