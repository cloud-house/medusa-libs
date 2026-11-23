import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261106115219 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice_correction" drop constraint if exists "invoice_correction_return_id_unique";`,
    )
    this.addSql(
      `create table if not exists "invoice_correction" ("id" text not null, "return_id" text not null, "order_id" text not null, "status" text check ("status" in ('waiting', 'issuing', 'issued', 'attention', 'failed')) not null default 'waiting', "attention_reason" text check ("attention_reason" in ('no_invoice', 'invoice_not_ready', 'partial_receipt')) null, "items" jsonb null, "includes_shipping" boolean not null default false, "fakturownia_id" text null, "number" text null, "total_cents" integer null, "attempts" integer not null default 0, "problem_since" timestamptz null, "next_attempt_at" timestamptz null, "last_error" text null, "error_kind" text check ("error_kind" in ('transient', 'permanent')) null, "alerted_for" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "invoice_correction_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_correction_return_id_unique" ON "invoice_correction" ("return_id") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_correction_order_id" ON "invoice_correction" ("order_id") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_correction_deleted_at" ON "invoice_correction" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "invoice_correction" cascade;`)
  }
}
