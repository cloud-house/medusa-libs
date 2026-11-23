import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261102085152 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_order_id_unique";`,
    )
    this.addSql(
      `create table if not exists "invoice" ("id" text not null, "order_id" text not null, "status" text check ("status" in ('waiting', 'issuing', 'issued', 'review', 'failed', 'skipped')) not null default 'waiting', "skip_reason" text check ("skip_reason" in ('canceled', 'unpaid')) null, "buyer_kind" text check ("buyer_kind" in ('company', 'person')) null, "fakturownia_id" text null, "number" text null, "difference_cents" integer null, "ksef" text check ("ksef" in ('none', 'pending', 'sent', 'ok', 'offline', 'error')) not null default 'none', "ksef_number" text null, "ksef_error" text null, "attempts" integer not null default 0, "problem_since" timestamptz null, "next_attempt_at" timestamptz null, "last_error" text null, "error_kind" text check ("error_kind" in ('transient', 'permanent')) null, "email_sent_at" timestamptz null, "email_attempts" integer not null default 0, "email_error" text null, "alerted_for" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "invoice_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_order_id_unique" ON "invoice" ("order_id") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_deleted_at" ON "invoice" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "invoice" cascade;`)
  }
}
