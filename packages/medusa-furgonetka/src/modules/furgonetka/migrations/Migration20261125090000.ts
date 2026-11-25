import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/**
 * Kit step 4c: the purpose of a parcel template became free text (the key of a parcel class the
 * shop declared), so the `check` that allowed four fixed values goes. Rows are not touched.
 */
export class Migration20261125090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "parcel_template" drop constraint if exists "parcel_template_purpose_check";`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "parcel_template" add constraint "parcel_template_purpose_check" check ("purpose" in ('board', 'courier_only', 'accessories_locker', 'accessories_courier'));`,
    )
  }
}
