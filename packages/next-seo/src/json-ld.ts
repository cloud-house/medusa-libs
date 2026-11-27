import type { ResolvedSeoConfig } from './config'
import type { SiteUrl } from './site'
import { filled, plainText, variantTitle } from './text'
import type { JsonLdNode, SeoArticle, SeoOrganization, SeoProduct, SeoVariant } from './types'

/** Dane strukturalne schema.org – czyste funkcje, wszystkie adresy absolutne. */

const CONTEXT = 'https://schema.org'
const SCHEMA = 'https://schema.org/'

/** Bez kluczy `undefined`/`null` – Google czyta brak pola, a nie pustą wartość. */
function compact(node: JsonLdNode): JsonLdNode {
  return Object.fromEntries(
    Object.entries(node).filter(([, value]) => value !== undefined && value !== null),
  )
}

const days = ([minValue, maxValue]: readonly [number, number]) => ({
  '@type': 'QuantitativeValue',
  minValue,
  maxValue,
  unitCode: 'DAY',
})

/**
 * Tekst do `<script type="application/ld+json">`: `<` jako `<`, więc tekst ze sklepu
 * (`</script>`) nie zamknie znacznika.
 */
export function jsonLdHtml(data: JsonLdNode | JsonLdNode[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function createJsonLd(config: ResolvedSeoConfig, site: SiteUrl) {
  const { absoluteUrl } = site

  function returnPolicy(returnDays: number): JsonLdNode {
    return {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: config.country,
      returnPolicyCategory: `${SCHEMA}MerchantReturnFiniteReturnWindow`,
      merchantReturnDays: returnDays,
      returnMethod: `${SCHEMA}ReturnByMail`,
      // Polski regulamin kitu: koszt odesłania ponosi kupujący.
      returnFees: `${SCHEMA}ReturnFeesCustomerResponsibility`,
    }
  }

  function shippingDetails(cost: number): JsonLdNode {
    return {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: cost, currency: config.currency },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: config.country },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: days(config.handlingDays),
        transitTime: days(config.transitDays),
      },
    }
  }

  function offer(variant: SeoVariant, url: string, returnDays: number): JsonLdNode {
    const { price, lowestPrice30d } = variant
    // Cena przekreślona = najniższa z 30 dni przed obniżką (Omnibus), tylko gdy wyższa od bieżącej.
    const strikethrough = lowestPrice30d !== null && lowestPrice30d > price
    return compact({
      '@type': 'Offer',
      url,
      price,
      priceCurrency: config.currency,
      priceSpecification: strikethrough
        ? {
            '@type': 'UnitPriceSpecification',
            priceType: `${SCHEMA}StrikethroughPrice`,
            price: lowestPrice30d,
            priceCurrency: config.currency,
          }
        : undefined,
      availability: variant.inStock ? `${SCHEMA}InStock` : `${SCHEMA}OutOfStock`,
      itemCondition: `${SCHEMA}NewCondition`,
      hasMerchantReturnPolicy: returnPolicy(returnDays),
      shippingDetails:
        variant.shippingCost !== null ? shippingDetails(variant.shippingCost) : undefined,
    })
  }

  const gtinOf = (variant: SeoVariant): JsonLdNode => {
    if (!variant.gtin) return {}
    return variant.gtin.length === 13 ? { gtin13: variant.gtin } : { gtin: variant.gtin }
  }

  const imagesOf = (images: string[]) =>
    images.length > 0 ? images.map((image) => absoluteUrl(image)) : undefined

  const brandOf = (product: SeoProduct) => {
    const name = filled(product.brand)
    return name ? { '@type': 'Brand', name } : undefined
  }

  const descriptionOf = (product: SeoProduct) =>
    filled(plainText(product.description)) ?? filled(plainText(product.subtitle))

  function productJsonLd(product: SeoProduct, ctx: { returnDays: number }): JsonLdNode {
    const canonical = absoluteUrl(config.routes.product(product.handle))

    const [single] = product.variants
    if (product.variants.length === 1 && single) {
      return compact({
        '@context': CONTEXT,
        '@type': 'Product',
        name: product.title,
        description: descriptionOf(product),
        image: imagesOf(single.images) ?? imagesOf(product.images),
        brand: brandOf(product),
        sku: single.sku,
        ...gtinOf(single),
        color: single.color,
        size: single.size,
        url: canonical,
        offers: offer(single, canonical, ctx.returnDays),
      })
    }

    const variesBy = [
      ...(product.variants.some((variant) => variant.size) ? [`${SCHEMA}size`] : []),
      ...(product.variants.some((variant) => variant.color) ? [`${SCHEMA}color`] : []),
    ]
    return compact({
      '@context': CONTEXT,
      '@type': 'ProductGroup',
      name: product.title,
      description: descriptionOf(product),
      image: imagesOf(product.images),
      brand: brandOf(product),
      url: canonical,
      productGroupID: product.handle,
      variesBy,
      hasVariant: product.variants.map((variant) => {
        const url = absoluteUrl(variant.path)
        return compact({
          '@type': 'Product',
          name: variantTitle(product.title, variant.size, variant.color),
          description: descriptionOf(product),
          image: imagesOf(variant.images) ?? imagesOf(product.images),
          brand: brandOf(product),
          sku: variant.sku,
          ...gtinOf(variant),
          color: variant.color,
          size: variant.size,
          url,
          offers: offer(variant, url, ctx.returnDays),
        })
      }),
    })
  }

  function breadcrumbJsonLd(
    items: { label: string; href?: string }[],
    current: { label: string; href: string },
  ): JsonLdNode {
    return {
      '@context': CONTEXT,
      '@type': 'BreadcrumbList',
      itemListElement: [...items, current].map((crumb, index) =>
        compact({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.label,
          item: crumb.href ? absoluteUrl(crumb.href) : undefined,
        }),
      ),
    }
  }

  const shop = () => ({ '@type': 'Organization', name: config.siteName, url: absoluteUrl('/') })

  function articleJsonLd(article: SeoArticle): JsonLdNode {
    return compact({
      '@context': CONTEXT,
      '@type': 'BlogPosting',
      headline: article.title,
      description: filled(article.description),
      image: article.image ? [absoluteUrl(article.image)] : undefined,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt ?? article.publishedAt,
      url: absoluteUrl(article.path),
      author: shop(),
      publisher: shop(),
    })
  }

  function organizationJsonLd(org: SeoOrganization): JsonLdNode {
    const sameAs = org.sameAs.flatMap((url) => filled(url) ?? [])
    const street = filled(org.address?.street)
    const city = filled(org.address?.city)
    return compact({
      '@context': CONTEXT,
      '@type': 'Organization',
      name: config.siteName,
      url: absoluteUrl('/'),
      logo: absoluteUrl(config.logoPath),
      legalName: filled(org.legalName),
      email: filled(org.email),
      telephone: filled(org.phone),
      sameAs: sameAs.length > 0 ? sameAs : undefined,
      address:
        street && city
          ? compact({
              '@type': 'PostalAddress',
              streetAddress: street,
              postalCode: filled(org.address?.postalCode),
              addressLocality: city,
              addressCountry: config.country,
            })
          : undefined,
    })
  }

  function websiteJsonLd(): JsonLdNode {
    return { '@context': CONTEXT, '@type': 'WebSite', name: config.siteName, url: absoluteUrl('/') }
  }

  return { productJsonLd, breadcrumbJsonLd, articleJsonLd, organizationJsonLd, websiteJsonLd }
}
