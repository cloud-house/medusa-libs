# @cloud-house/medusa-content

Medusa 2 plugin: **editorial content** for a shop – info pages with a full history of versions,
a blog (articles and categories), header, announcement bar, footer, store settings and a home page
of blocks, edited in the Medusa admin („Treści”) with drafts, autosave, a media library, a Lexical
rich-text editor and a signed preview link. The store reads everything from `/store/content/*`.

The plugin is a **content engine with a kind registry**: what can be written is described by *kinds*
(`kinds` option). It ships ready-made kinds for the generic content above; a shop registers its own
(a quiz, FAQ, content of its products…) and they run through the same routes, versions, references
and panel primitives.

```sh
pnpm add --save-exact @cloud-house/medusa-content
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`. Run `medusa db:migrate` –
the module has six tables (`content_entry`, `content_version`, `content_ref`, `catalog_handle`,
`handle_redirect`, `media_asset`). A file provider (S3 or local) must be configured: uploads go
through Medusa's file module.

## Setup

```ts
// medusa-config.ts
import { contentKinds } from '@cloud-house/medusa-content'

plugins: [
  {
    resolve: '@cloud-house/medusa-content',
    options: {
      kinds: contentKinds({
        reservedSlugs: ['cart', 'account'], // addresses of your own storefront routes
        protectedSlugs: ['terms', 'privacy'], // pages the checkout and e-mails link to
      }),
    },
  },
]
```

Do not list the `content` module in `modules` – the plugin registers it.

## Options

| Option | Default | Meaning |
|---|---|---|
| `kinds` | – (required) | The kinds of content, see below. |
| `previewSecret` | `process.env.CONTENT_PREVIEW_SECRET` | Signs the preview token (shared with the storefront). |
| `previewHeader` | `x-preview-token` | Request header that carries the token on `?draft=1` reads. |
| `previewPath` | `/api/preview` | Storefront route the preview link opens (`STOREFRONT_URL` + path). |
| `mediaFolder` | `content` | Folder of uploaded files in the file provider. |
| `logPrefix` | `[Content]` | Prefix of the log lines. |
| `resolveEntityHandle(container, kind, entityId)` | Product module / `brand` module | Current handle of a product, category or brand (address history). |

Wrong options fail at start-up: `content_missing_option` (no `kinds`) and `content_invalid_option`
(empty list, repeated `type`, a global kind without `slug`, bad key, unknown `entity`…).

## Kinds

```ts
import { contentKinds, defineKind } from '@cloud-house/medusa-content'
import { z } from '@medusajs/framework/zod'

const faq = defineKind({
  type: 'faq', // [a-z0-9_]{1,40}
  label: 'FAQ',
  schema: z.object({ question: z.string().min(1, 'Podaj pytanie.'), answer: z.string() }),
  // draftSchema: softer check of a working copy (default: schema)
  versions: { drafts: true, maxVersions: 50 }, // default: no drafts, no history; 0 = keep all
  refs: [['image', 'media']], // paths of ids the data points at (media, product, category, brand, entry, lexical)
})

options: { kinds: [...contentKinds(), faq] }
```

| Field | Meaning |
|---|---|
| `type` | Key of the kind. `global` = one document identified by `slug` (header, footer…). |
| `schema` / `draftSchema` | Zod checks for publishing / a working copy. The first issue reaches the editor as `path: message`. |
| `versions` | `{ drafts, maxVersions }`. |
| `refs` | `[path, kind][]`; `*` = every row of an array; `lexical` walks editor content. Drives „in use” guards and the media library. |
| `entity` | `'product' \| 'category' \| 'brand'` – content bound to a Medusa record (`/admin/content/catalog/:type/:id`, `/store/content/catalog/:type/:handle`). |
| `view` | Store view of an entry (default: the data with the documents it points at filled in). |
| `defaults` / `initial` | What the store shows / the panel starts from before a global is saved. |
| `protectedSlugs`, `prepare`, `deleteGuard`, `enrich` | Protected addresses, computed fields on save, delete guard, I/O after the view. |

Ready-made kinds: `pageKind`, `articleKind`, `articleCategoryKind`, `headerKind`,
`announcementBarKind`, `footerKind`, `storeSettingsKind`, `homePageKind`; `contentKinds(options)`
returns them all (`reservedSlugs`, `protectedSlugs`, `layoutDefaults`, `extraBlocks`, `defaults`).

### Home page blocks of your own

```ts
homePageKind({
  extraBlocks: [{
    type: 'promo', label: 'Promo', single: true,
    schema: z.object({ ...homeBlockBase, blockType: z.literal('promo'), title: homeText(80, true) }),
    refs: [['layout.*.image', 'media']],
    view: (raw, id) => ({ type: 'promo', id, title: String(raw.title) }),
  }],
})
```

and in the shop's admin code (`@cloud-house/medusa-content/admin-kit`): `registerHomeBlock({ type, label, empty, render })`.

## Routes

Admin: `/admin/content/{entries,globals,catalog,media,preview,versions}`. Store:
`/store/content/{pages,articles,article-categories,layout,home,catalog,moved,sitemap}`.
`?draft=1` returns the working copy only with a valid token in the `previewHeader` (otherwise 401).
Routes for kinds of the shop (a quiz…) are the shop's own; they can use the exported helpers
`readPublished`, `readEntity`, `populate`, `loadLookups`, `draftRequested`, `stateOf`.

## Events

`content.changed`, `content.deleted` (`{ id, type, slug, previous_slug?, handle?, published }`) and
`content.handle-changed` (`{ kind, id, old_handle, handle }`, a product/category/brand was renamed –
the old address answers with a redirect). Wire them to your cache invalidation
(`@cloud-house/medusa-revalidation`).

## Admin panel

„Treści” (`/tresci`): pages, articles and categories, home page, layout, media. Building blocks for
your own pages (`EditorPage`, `DocumentToolbar`, fields, `MediaField`, `RelationField`,
`useEntryEditor`, the API client, `registerHubSection`) are exported from
`@cloud-house/medusa-content/admin-kit`.

## Environment

`CONTENT_PREVIEW_SECRET` (preview token), `STOREFRONT_URL` (preview link). `contentWarnings(process.env)`
returns start-up warnings for `medusa-config.ts`.

## Not in this package

The storefront (client, preview mode, rendering Lexical) – `next-content`, a separate package;
translations; scheduled publication; roles.

## Migrations

Six tables; the last migration (`Migration20261125140000`) drops the `check` on
`content_entry.type`, so `type` is the key of any registered kind. Safe for existing data.

## License

MIT
