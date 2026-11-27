# @cloud-house/next-seo

SEO for a Next.js 16 storefront of a Medusa 2 shop in Poland: site URL, canonical paths, Open Graph and Twitter metadata, `robots.txt`, sitemap, JSON-LD (Product / ProductGroup with offers, shipping and return policy, BreadcrumbList, BlogPosting, Organization, WebSite) and the Google Merchant Center feed. Pure functions, no React, no `next/*` imports and no runtime dependencies; results have the shapes Next expects (`Metadata`, `MetadataRoute.Robots`, `MetadataRoute.Sitemap`).

```sh
pnpm add @cloud-house/next-seo
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`.

## Setup

One instance per shop, e.g. `lib/seo/seo.ts`:

```ts
import { createSeo } from '@cloud-house/next-seo'

export const seo = createSeo({
  siteName: 'Mój Sklep',
  shopTitle: 'Mój Sklep – deski i akcesoria',
  feedDescription: 'Deski i akcesoria sprawdzonych marek.',
  devSiteUrl: 'http://localhost:3200',
})
```

| Option | Default | Meaning |
| --- | --- | --- |
| `siteName` | required | `og:site_name`, Organization / WebSite name, author and publisher of articles |
| `shopTitle` | required | home page title, Merchant feed channel title, default share image alt |
| `feedDescription` | required | Merchant feed channel description |
| `devSiteUrl` | `http://localhost:3000` | site address in development when `SITE_URL` is unset |
| `locale` | `pl_PL` | Open Graph locale |
| `currency` | `PLN` | offers and feed prices |
| `country` | `PL` | shipping destination, return policy, company address |
| `logoPath` | `/logo.png` | logo in Organization JSON-LD (keep it stable – no hashed URL) |
| `defaultShareImage` | `/opengraph-image` 1200×630 | share image of pages without their own |
| `handlingDays` / `transitDays` | `[0, 1]` / `[1, 2]` | delivery time in offer JSON-LD |
| `routes.product` / `routes.brand` | `/produkt/:handle` / `/marki/:handle` | canonical paths |
| `logPrefix` | none | log prefix for the shop's own code |

Environment, read on every call (never frozen at import): `SITE_URL` (required in production, `https` except on localhost; a path prefix is kept) and `SITE_INDEXABLE=true` (indexing on – set it at launch only).

## What it gives

- `seo.siteUrl()`, `seo.absoluteUrl(path)`, `seo.siteIndexable()`.
- `seo.productCanonical(handle)`, `seo.brandCanonical(handle)`, `categoryCanonical({ root, child? })`, `pagedCanonical(path, page)`.
- `seo.socialMetadata({ title, description?, path, image?, type?, publishedTime? })` → `{ openGraph, twitter }`; `seo.shareImage(image, fallbackAlt)`; `seo.defaultShareImage`.
- `seo.buildRobots({ allow, disallow })` – everything disallowed until `SITE_INDEXABLE=true`; then the shop's rules and the sitemap address.
- `seo.buildSitemap([{ path, lastModified? }])` – absolute, in order, each address once. Which pages go in is the shop's call.
- `seo.productJsonLd(product, { returnDays })`, `seo.breadcrumbJsonLd(items, current)`, `seo.articleJsonLd(article)`, `seo.organizationJsonLd(org)`, `seo.websiteJsonLd()`, `jsonLdHtml(data)`.
- `seo.buildMerchantFeed(products)` – RSS 2.0, one item per variant.
- `plainText(html)`, `variantTitle(title, ...attributes)`.

## `SeoProduct`

JSON-LD and the Merchant feed read one shape, `SeoProduct` with `SeoVariant[]` (see `src/types.ts`). The shop maps its catalogue to it and computes what depends on its own rules:

- `shippingCost` – the delivery cost of this item alone (e.g. the cheapest allowed method, free above the threshold); `null` drops the shipping fields.
- `googleCategory` – Google product taxonomy id for the shop's categories.
- `gtin` – an already checked GTIN (13 digits → `gtin13`).
- `path` – the variant page path (size and colour in the address).
- `price`, `regularPrice` (sale price in the feed when higher), `lowestPrice30d` (Omnibus – strikethrough price in JSON-LD when higher).

The return policy in JSON-LD is the Polish default of the kit (`medusa-returns`): finite window of `returnDays`, by mail, the buyer pays the return.

## In Next

```ts
// app/robots.ts
export const dynamic = 'force-dynamic'
export default () => seo.buildRobots({ allow: ['/'], disallow: ['/konto', '/koszyk', '/api/'] })

// app/sitemap.ts
export const dynamic = 'force-dynamic'
export default async () => seo.buildSitemap(await loadSitemapPaths())

// app/feeds/google-merchant.xml/route.ts – a failure answers 503, never an empty feed
export async function GET() {
  try {
    const xml = seo.buildMerchantFeed(await loadSeoProducts())
    return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
  } catch {
    return new Response('Feed unavailable', { status: 503, headers: { 'retry-after': '600' } })
  }
}

// components/JsonLd.tsx
export const JsonLd = ({ data }: { data: JsonLdNode | JsonLdNode[] }) => (
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }} />
)
```

An empty feed would make Google withdraw every product – answer 503 ("try later") when the catalogue is down.
