import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261103133228 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "shipment" drop constraint if exists "shipment_order_id_unique";`,
    )
    this.addSql(
      `alter table if exists "parcel_template" drop constraint if exists "parcel_template_purpose_unique";`,
    )
    this.addSql(
      `create table if not exists "furgonetka_connection" ("id" text not null, "state" text check ("state" in ('connected', 'disconnected')) not null default 'disconnected', "account" text null, "access_token" text null, "refresh_token" text null, "access_expires_at" timestamptz null, "connected_at" timestamptz null, "oauth_state" text null, "oauth_state_expires_at" timestamptz null, "last_error" text null, "alerted_for" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "furgonetka_connection_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_furgonetka_connection_deleted_at" ON "furgonetka_connection" ("deleted_at") WHERE deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "parcel_template" ("id" text not null, "name" text not null, "kind" text check ("kind" in ('locker_a', 'locker_b', 'locker_c', 'box')) not null, "length_cm" integer not null, "width_cm" integer not null, "height_cm" integer not null, "weight_g" integer not null, "purpose" text check ("purpose" in ('board', 'courier_only', 'accessories_locker', 'accessories_courier')) null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "parcel_template_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_parcel_template_deleted_at" ON "parcel_template" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_parcel_template_purpose_unique" ON "parcel_template" ("purpose") WHERE purpose IS NOT NULL AND deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "shipment" ("id" text not null, "order_id" text not null, "state" text check ("state" in ('draft', 'creating', 'failed', 'ready', 'in_transit', 'delivered', 'problem', 'canceled')) not null default 'draft', "carrier" text check ("carrier" in ('dpd', 'inpost_courier', 'inpost_locker')) not null, "receiver" jsonb not null, "parcels" jsonb not null, "declared_value_cents" integer not null, "pickup" text check ("pickup" in ('courier', 'drop_off')) not null default 'courier', "pickup_status" text check ("pickup_status" in ('none', 'ordered', 'failed')) not null default 'none', "pickup_date" text null, "pickup_from" text null, "pickup_to" text null, "pickup_id" text null, "reference" text null, "package_id" text null, "order_command_id" text null, "tracking" jsonb null, "cost_cents" integer null, "fulfillment_id" text null, "tracking_status" text null, "history" jsonb null, "last_error" text null, "cancel_error" text null, "shipped_at" timestamptz null, "delivered_at" timestamptz null, "canceled_at" timestamptz null, "alerted_for" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shipment_order_id" ON "shipment" ("order_id") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shipment_deleted_at" ON "shipment" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_order_id_unique" ON "shipment" ("order_id") WHERE state != 'canceled' AND deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "furgonetka_connection" cascade;`)

    this.addSql(`drop table if exists "parcel_template" cascade;`)

    this.addSql(`drop table if exists "shipment" cascade;`)
  }
}
