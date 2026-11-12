import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261026073722 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "favorite" drop constraint if exists "favorite_customer_id_product_id_unique";`,
    )
    this.addSql(
      `create table if not exists "favorite" ("id" text not null, "customer_id" text not null, "product_id" text not null, "added_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "favorite_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_favorite_deleted_at" ON "favorite" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_favorite_customer_id_product_id_unique" ON "favorite" ("customer_id", "product_id") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "favorite" cascade;`)
  }
}
