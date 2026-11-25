import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261109112246 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_entry" drop constraint if exists "content_entry_type_entity_id_unique";`,
    )
    this.addSql(
      `alter table if exists "content_entry" drop constraint if exists "content_entry_type_slug_unique";`,
    )
    this.addSql(
      `alter table if exists "catalog_handle" drop constraint if exists "catalog_handle_kind_entity_id_unique";`,
    )
    this.addSql(
      `create table if not exists "catalog_handle" ("id" text not null, "kind" text check ("kind" in ('product', 'category', 'brand')) not null, "entity_id" text not null, "handle" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "catalog_handle_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_catalog_handle_deleted_at" ON "catalog_handle" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_catalog_handle_kind_entity_id_unique" ON "catalog_handle" ("kind", "entity_id") WHERE deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "content_entry" ("id" text not null, "type" text check ("type" in ('page', 'article', 'article_category', 'product', 'category', 'brand', 'global')) not null, "slug" text null, "entity_id" text null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "data" jsonb null, "draft" jsonb null, "published_at" timestamptz null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_entry_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_entry_deleted_at" ON "content_entry" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_entry_type_slug_unique" ON "content_entry" ("type", "slug") WHERE slug IS NOT NULL AND deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_entry_type_entity_id_unique" ON "content_entry" ("type", "entity_id") WHERE entity_id IS NOT NULL AND deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "content_ref" ("id" text not null, "entry_id" text not null, "state" text check ("state" in ('published', 'draft')) not null, "target_type" text check ("target_type" in ('media', 'product', 'category', 'brand', 'entry')) not null, "target_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_ref_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_ref_deleted_at" ON "content_ref" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_ref_entry_id" ON "content_ref" ("entry_id") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_ref_target_type_target_id" ON "content_ref" ("target_type", "target_id") WHERE deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "content_version" ("id" text not null, "entry_id" text not null, "snapshot" jsonb not null, "status" text check ("status" in ('draft', 'published')) not null, "autosave" boolean not null default false, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_version_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_version_deleted_at" ON "content_version" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_version_entry_id_created_at" ON "content_version" ("entry_id", "created_at") WHERE deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "handle_redirect" ("id" text not null, "kind" text check ("kind" in ('product', 'category', 'brand')) not null, "old_handle" text not null, "entity_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "handle_redirect_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_handle_redirect_deleted_at" ON "handle_redirect" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_handle_redirect_kind_old_handle" ON "handle_redirect" ("kind", "old_handle") WHERE deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "media_asset" ("id" text not null, "kind" text check ("kind" in ('image', 'document')) not null, "file_id" text not null, "url" text not null, "filename" text not null, "mime_type" text not null, "filesize" integer not null, "width" integer null, "height" integer null, "alt" text not null default '', "credit" text null, "credit_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "media_asset_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_asset_deleted_at" ON "media_asset" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_asset_kind" ON "media_asset" ("kind") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "catalog_handle" cascade;`)

    this.addSql(`drop table if exists "content_entry" cascade;`)

    this.addSql(`drop table if exists "content_ref" cascade;`)

    this.addSql(`drop table if exists "content_version" cascade;`)

    this.addSql(`drop table if exists "handle_redirect" cascade;`)

    this.addSql(`drop table if exists "media_asset" cascade;`)
  }
}
