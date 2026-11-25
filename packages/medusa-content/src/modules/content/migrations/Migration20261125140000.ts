import { Migration } from '@medusajs/framework/mikro-orm/migrations'

const OLD_TYPES = `'page', 'article', 'article_category', 'product', 'category', 'brand', 'global'`

/** `content_entry.type` is the key of a registered kind, no longer one of seven fixed values. */
export class Migration20261125140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_entry" drop constraint if exists "content_entry_type_check";`,
    )
  }

  override async down(): Promise<void> {
    // The old check can come back only while no row has a kind outside the old seven.
    this.addSql(
      `do $$ begin if not exists (select 1 from "content_entry" where "type" not in (${OLD_TYPES})) then alter table if exists "content_entry" add constraint "content_entry_type_check" check ("type" in (${OLD_TYPES})); end if; end $$;`,
    )
  }
}
