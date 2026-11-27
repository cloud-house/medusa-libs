# medusa-libs

Medusa 2 plugins and commerce logic shared by cloud-house shops. Pnpm + Turbo monorepo, versioned
per package with [Changesets](https://github.com/changesets/changesets), published to GitHub Packages
under the `@cloud-house` scope.

## Packages

Versions are independent per package; see each package's README and CHANGELOG.

| Package | Version | What it is | Key options |
|---|---|---|---|
| [`@cloud-house/commerce-rules`](packages/commerce-rules) | 0.9.0 | Pure commerce rules: price format, plurals, tax id, seller line, Omnibus, discounts, stock, handle slugs, cache-tag rules | `formatPrice(amount, { currency, locale })`, `pluralize(count, forms, { locale })`, `lineDiscountLabel(parts, { locale, messages })`, `sellerLine(seller, { locale, taxIdLabel })`, `createTagRules(...)` |
| [`@cloud-house/medusa-brands`](packages/medusa-brands) | 0.1.6 | Medusa plugin: product brands (module, product link, workflows with `brand.*` events, admin list and product widget, `GET /store/brands`) | `locale`, `messages`, `storeRoute`, `adminDetailLinks` |
| [`@cloud-house/medusa-accounts`](packages/medusa-accounts) | 0.2.0 | Medusa plugin: customer accounts (registration, e-mail confirmation, password reset, checkout sign-up, account deletion): workflows, subscribers, three account e-mails, `/store/account/*` routes and their middlewares | `paths`, `storefrontUrl`, `locale`, `messages`, `resolveContact`, `onAccountDeleted`, `emailThrottle`, `deletedEmail`, `createAccountFlag` |
| [`@cloud-house/medusa-emails`](packages/medusa-emails) | 0.1.0 | Medusa Notification provider: transactional e-mails (Resend provider, themed React Email layout, renderer, send workflow, preview helper); the shop brings the templates | `theme`, `templates`, `locale`, `messages`, `apiKey`, `from`, `replyTo`, `mode`, `previewDir`, `channels` |
| [`@cloud-house/medusa-favorites`](packages/medusa-favorites) | 0.2.5 | Medusa plugin: customer favourites (module, `/store/account/favorites` routes, guest-list merge, visibility filter); no admin | `limit`, `locale`, `messages` |
| [`@cloud-house/medusa-fakturownia`](packages/medusa-fakturownia) | 0.1.5 | Medusa plugin: Fakturownia invoices and credit notes (module with `invoice` and `invoice_correction`, KSeF, e-mail with the PDF, retry job, admin invoice card, PDF download of the own order); the shop supplies order and return data through `resolveOrder`, `resolveReturnOrder`, `resolveReturn` | `paymentTypes`, `oidPrefix`, `logPrefix`, `accountOrderPath`, `resolveContact` |
| [`@cloud-house/medusa-returns`](packages/medusa-returns) | 0.1.4 | Medusa plugin: customer returns (guest and account claims, return window from delivery, lock per order, closed native `POST /store/returns`, two e-mails); returns are Medusa's own returns, the module only holds the options; the shop supplies the order and the contact through `resolveOrder`, `resolveContact` | `labelPath`, `accountOrderPath`, `logPrefix`, `emailCopy` |
| [`@cloud-house/medusa-furgonetka`](packages/medusa-furgonetka) | 0.1.3 | Medusa plugin: Furgonetka shipping – DPD and InPost shipments, labels, pickups, tracking (webhook and job), shipment e-mails, alerts, admin queue / settings / order card; module with `furgonetka_connection`, `parcel_template`, `shipment`; bulky items through configurable parcel classes; the shop supplies the order and the contact through `resolveOrder`, `resolveContact` | `parcelClasses`, `resolveParcelClasses`, `referencePrefix`, `deliveryCodes`, `senderName`, `stockLocationName`, `logPrefix`, `accountOrderPath` |
| [`@cloud-house/medusa-checkout-pl`](packages/medusa-checkout-pl) | 0.1.2 | Medusa plugin: Polish checkout backend – Stripe card/BLIK/P24 config, shipping rates and delivery options, parcel locker rule from parcel classes, checkout check, order summary, delivery review and the order confirmation e-mail; no tables | `resolveContact`, `variantLabels`, `groupLines`, `deliveryCodes`, `blockReasons`, `texts`, `currency`, `logPrefix` |
| [`@cloud-house/medusa-content`](packages/medusa-content) | 0.1.2 | Medusa plugin: editorial content – kind registry in options (`kinds`, ready-made `contentKinds()`: page, article, article category, layout, store settings, home blocks), drafts, versions, references, handle history, media, preview token, admin/store routes and the „Treści” admin panel (`./admin-kit` for shop UI) | `kinds`, `previewSecret`, `previewHeader`, `previewPath`, `mediaFolder`, `logPrefix`, `resolveEntityHandle` |
| [`@cloud-house/medusa-newsletter`](packages/medusa-newsletter) | 0.2.0 | Medusa plugin: sign-ups with proof of consent, admin page `/app/newsletter`, CSV, GDPR delete | `locale`, `messages`, `storefrontSecret: { header, env }`, `sources` |
| [`@cloud-house/medusa-omnibus`](packages/medusa-omnibus) | 0.1.9 | Medusa plugin: hourly price snapshots and the `priceHistory` module | `locale`, `messages`, `logPrefix` |
| [`@cloud-house/medusa-revalidation`](packages/medusa-revalidation) | 0.2.5 | Library for the Medusa backend (not a plugin): maps Medusa events to cache tags and POSTs them to the storefront | `createRevalidationSubscriber({ events, tagsForEvent, urlEnv, secretEnv, header, isAllowedTag, logPrefix, locale, messages })` |
| [`@cloud-house/next-medusa`](packages/next-medusa) | 0.1.7 | Library for a Next.js 16 storefront: Medusa SDK getter, env check, cached fetch init with a version header, `/api/revalidate` route, cart cookie | `medusaEnv`, `cachedInit`, `createRevalidateRoute({ secretEnv, header, isAllowedTag, locale, messages, logPrefix })`, `createCartCookie({ name, maxAgeDays })` |
| [`@cloud-house/next-content`](packages/next-content) | 0.1.3 | Library for a Next.js 16 storefront using `medusa-content`: content client for `/store/content/*` (cached with tags or draft preview), preview session and enter/exit routes, Lexical → JSX renderer, live preview refresh (`'use client'`) | `fetch`, `viewVersion`, `versionHeader`, `revalidate`, `previewHeader`, `cookieName`, `secretEnv` |
| [`@cloud-house/next-commerce`](packages/next-commerce) | 0.2.0 | Library for a Next.js 16 storefront on Medusa: `./cart` (cart client with retry on a new cart, promotion codes, cart view), `./checkout` (Polish checkout form and validation, checkout flow, Medusa calls, order view, Stripe adapter), `./newsletter` (sign-up with consent proof, Resend provider), `./account` (customer account client and forms), `./favorites` (guest list, sync with the account), `./returns` (return forms, label, Medusa calls); no React, no server actions | `addItems`, `groupLines`, `href`, `hiddenSize`, `secretHeader`, `logPrefix`, `consentText`, favourites `key`, `orderPrefix` |
| [`@cloud-house/next-seo`](packages/next-seo) | 0.1.0 | Library for a Next.js 16 storefront: site URL from `SITE_URL`, canonical paths, Open Graph, robots, sitemap, JSON-LD (Product/ProductGroup, Breadcrumb, Article, Organization, WebSite) and the Google Merchant feed from the package's own `SeoProduct` type; no React, no `next/*` | `siteName`, `shopTitle`, `feedDescription`, `devSiteUrl`, `locale`, `currency`, `country`, `logoPath`, `routes` |

Plugins (`medusa-accounts`, `medusa-brands`, `medusa-favorites`, `medusa-newsletter`, `medusa-omnibus`) go into `plugins`
of `medusa-config.ts`; `medusa-emails` is a Notification provider and goes into the Notification module (see below); libraries (`commerce-rules`, `medusa-revalidation`, `next-medusa`) are plain
dependencies you import.

## Example `medusa-config.ts`

```ts
import { defineConfig } from '@medusajs/framework/utils'

module.exports = defineConfig({
  projectConfig: { /* database, secrets, CORS */ },
  plugins: [
    {
      resolve: '@cloud-house/medusa-newsletter',
      options: {
        locale: 'pl',
        storefrontSecret: { header: 'x-acme-storefront-secret', env: 'STOREFRONT_API_SECRET' },
      },
    },
    { resolve: '@cloud-house/medusa-omnibus', options: { logPrefix: 'Acme' } },
    {
      resolve: '@cloud-house/medusa-brands',
      options: {
        locale: 'en',
        // true: the list shows a "details" button linking to /brands/:id, a page your shop provides
        adminDetailLinks: false,
        // false: GET /store/brands answers 404 (a route file of your own replaces it either way)
        storeRoute: true,
      },
    },
    {
      resolve: '@cloud-house/medusa-favorites',
      options: { locale: 'en', limit: 50 },
    },
  ],
})
```

Run `medusa db:migrate` after adding a plugin (it also syncs links unless you pass `--skip-links`). Do not
also list a plugin's module under `modules`: that entry replaces the plugin's module and its options.

## E-mails and accounts

`medusa-emails` is a Notification provider: the theme (shop name, colours, footer links) and the
**list of templates** go into the provider options, there is no global template registry. A plugin
that sends e-mails (here `medusa-accounts`) exports its templates, and the shop adds them to the list
next to its own.

```ts
import { accountEmailTemplates } from '@cloud-house/medusa-accounts'
import { emailEnv, type EmailsOptions } from '@cloud-house/medusa-emails'

const emails: EmailsOptions = {
  channels: ['email'],
  ...emailEnv(process.env), // RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, EMAIL_PREVIEW_DIR
  theme: {
    shopName: 'Acme',
    colors: { yellow: '#f0c93a' },
    footerLinks: [{ label: 'Terms', url: 'https://shop.example.com/terms' }], // absolute URLs
  },
  templates: [...accountEmailTemplates, welcomeTemplate], // the shop's own templates after the kit's
}

// medusa-config.ts
modules: [
  {
    resolve: '@medusajs/medusa/notification',
    options: {
      providers: [{ resolve: '@cloud-house/medusa-emails/providers/resend', id: 'resend', options: emails }],
    },
  },
],
plugins: [
  {
    resolve: '@cloud-house/medusa-accounts',
    options: {
      paths: { confirmEmail: '/confirm-email', setPassword: '/set-password', passwordReset: '/reset-password' },
      storefrontUrl: process.env.STOREFRONT_URL,
      // contact block of the account e-mails (and Reply-To); none by default
      resolveContact: async (container) => ({ email: 'shop@example.com', phone: null, hours: null }),
      // cleanup hooks run while an account is erased; a throwing hook aborts the deletion
      onAccountDeleted: [async (container, customerId) => { /* e.g. remove the customer's favourites */ }],
      // e-mail left on an erased account row (default `deleted+<id>@account-deleted.invalid`)
      deletedEmail: (customerId) => `deleted+${customerId}@shop.invalid`,
      // order metadata entry set by the checkout's "create an account" checkbox (default `create_account` = `true`)
      createAccountFlag: { key: 'create_account', value: 'true' },
    },
  },
],
```

Plugin options reach subscribers, workflows and routes through a tiny module the plugin registers
(no tables, no migrations: nothing is added to your database). The plugin's middlewares are merged
with the shop's own `src/api/middlewares.ts`; the shop keeps its own routes (e.g. orders) and lists
`authenticate(...)` for them. See the packages' READMEs.

## Storefront revalidation

Backend: a subscriber built with `@cloud-house/medusa-revalidation` sends cache tags to the storefront
after Medusa events (products, categories, stock, prices, promotions and `brand.*` out of the box).

```ts
// src/subscribers/revalidate-storefront.ts
import { createTagRules, KIT_TAG_KINDS, KIT_TAGS } from '@cloud-house/commerce-rules'
import {
  createRevalidationSubscriber,
  DEFAULT_REVALIDATION_EVENTS,
  defaultTagsForEvent,
} from '@cloud-house/medusa-revalidation'

// A shop tag such as 'pages' is outside the kit allowlist: build the rules once and pass the
// SAME `isAllowedTag` to the subscriber and to the storefront route.
const { isAllowedTag } = createTagRules({
  tags: [...Object.values(KIT_TAGS), 'pages'],
  kinds: [...KIT_TAG_KINDS],
})

const { handler, config: subscriberConfig } = createRevalidationSubscriber({
  events: [...DEFAULT_REVALIDATION_EVENTS, 'acme.page.changed'],
  tagsForEvent: async (name, data, lookup) =>
    (await defaultTagsForEvent(name, data, lookup)) ?? ['pages'],
  isAllowedTag,
  logPrefix: 'Acme',
})

export default handler
export const config = subscriberConfig
```

It reads `STOREFRONT_URL` and `REVALIDATE_SECRET` (names are options) and POSTs `{ tags }` to
`<STOREFRONT_URL>/api/revalidate` with the secret in `x-revalidate-secret`.

Storefront: `@cloud-house/next-medusa` (`pnpm add @cloud-house/next-medusa @medusajs/js-sdk server-only`;
peer `next` 16). It has two entries: `@cloud-house/next-medusa` is safe in client code,
`@cloud-house/next-medusa/server` imports `server-only`.

```ts
// app/api/revalidate/route.ts
import { createTagRules, KIT_TAG_KINDS, KIT_TAGS } from '@cloud-house/commerce-rules'
import { createRevalidateRoute } from '@cloud-house/next-medusa/server'

// Same rules as in the backend subscriber, otherwise 'pages' is rejected with 400.
const { isAllowedTag } = createTagRules({
  tags: [...Object.values(KIT_TAGS), 'pages'],
  kinds: [...KIT_TAG_KINDS],
})

export const { POST } = createRevalidateRoute({ isAllowedTag, logPrefix: 'Acme' })
```

```ts
// lib/medusa.ts
import { KIT_TAGS, productTag } from '@cloud-house/commerce-rules'
import { cachedInit } from '@cloud-house/next-medusa'
import { createCartCookie, createSdkGetter, medusaEnv } from '@cloud-house/next-medusa/server'

// lazy: a missing variable fails on the first fetch, not when the module is imported
export const env = () => medusaEnv({ defaultBackendUrl: 'http://localhost:9000' })
export const getSdk = createSdkGetter(env)
export const cartCookie = createCartCookie({ name: 'acme_cart' })

// fetch init: force-cache, tags, revalidate seconds, and a version header; bump `version`
// whenever the shape of a cached response changes
export const productInit = (handle: string) =>
  cachedInit({ tags: [KIT_TAGS.catalog, productTag(handle)], revalidate: 300, versionHeader: 'x-acme-api-version', version: 1 })
```

Both sides use the tag rules from `commerce-rules` (`catalog`, `promotions`, `product:*`,
`category:*`, `brand:*` by default; `createTagRules` adds your own), so the backend never sends a
tag the storefront rejects.

## Installing in a shop

The packages live in GitHub Packages, which requires a token even for public packages: without
`NODE_AUTH_TOKEN` (or with an expired one) `pnpm install` fails with 401. CI, Docker builds and
hosting need the same token with `read:packages`.

1. Create a token with the `read:packages` scope (classic personal access token, or
   `gh auth refresh -h github.com -s read:packages`).
2. Add to the shop's project `.npmrc` only the registry (no token; pnpm 11 ignores credentials
   with env variables in a project `.npmrc`):

   ```
   @cloud-house:registry=https://npm.pkg.github.com
   ```

3. Put the token reference in your user-level `~/.npmrc` (CI: `actions/setup-node` with
   `registry-url: https://npm.pkg.github.com` writes the same line), and export the token:

   ```sh
   grep -qF 'npm.pkg.github.com/:_authToken' ~/.npmrc 2>/dev/null \
     || echo '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' >> ~/.npmrc
   export NODE_AUTH_TOKEN=...
   ```

4. Install with an exact version, e.g. `pnpm add --save-exact @cloud-house/medusa-newsletter@0.1.1`.

## Claude Code plugin

`/plugin marketplace add cloud-house/medusa-libs`, then install `kit-sklepow`: skills `pulapki-medusa-next`
(collected pitfalls), `plugin-kitu` (how to add a package or plugin to this repo) and `nowy-sklep` (draft).

## Development

Requires Node 22.22+ or 24 (see `.nvmrc`) and pnpm 11.

```sh
pnpm install
pnpm lint
pnpm build
pnpm test
```

Plugin integration tests need Postgres. A local one on port 55532:

```sh
docker compose up -d
export DB_HOST=localhost DB_PORT=55532 DB_USERNAME=medusa DB_PASSWORD=medusa
export JWT_SECRET=test-jwt-secret COOKIE_SECRET=test-cookie-secret
export STOREFRONT_API_SECRET=test-only-storefront-api-secret
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the release flow.

## License

MIT
