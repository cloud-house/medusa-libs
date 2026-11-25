import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261109162141 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_entry" add column if not exists "last_published_at" timestamptz null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "content_entry" drop column if exists "last_published_at";`)
  }
}
