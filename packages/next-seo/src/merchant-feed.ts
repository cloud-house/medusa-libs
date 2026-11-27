import type { ResolvedSeoConfig } from './config'
import type { SiteUrl } from './site'
import { plainText, variantTitle } from './text'
import type { SeoProduct, SeoVariant } from './types'

/** Plik produktów Google Merchant Center: RSS 2.0, jedna pozycja na wariant. */

const MAX_TITLE = 150
const MAX_DESCRIPTION = 5000
const MAX_ADDITIONAL_IMAGES = 10

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}
/** Znaki sterujące C0 poza tabulatorem, LF i CR – XML 1.0 ich nie dopuszcza, a jeden psuje cały plik. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: właśnie te znaki usuwamy
const XML_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g
const escapeXml = (text: string) =>
  text.replace(XML_FORBIDDEN, '').replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char)

const element = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === ''
    ? ''
    : `<${name}>${escapeXml(String(value))}</${name}>`

export function createMerchantFeed(config: ResolvedSeoConfig, site: SiteUrl) {
  const { absoluteUrl } = site
  const price = (amount: number) => `${amount.toFixed(2)} ${config.currency}`

  /** Zdjęcia wariantu, a gdy ich nie ma – produktu (zdjęcia produktu mają wszystkie kolory). */
  const images = (product: SeoProduct, variant: SeoVariant) =>
    (variant.images.length > 0 ? variant.images : product.images).map((url) => absoluteUrl(url))

  function item(product: SeoProduct, variant: SeoVariant): string | null {
    const [image, ...additional] = images(product, variant)
    // Google odrzuca pozycję bez zdjęcia.
    if (!image) return null
    const title = [product.brand, variantTitle(product.title, variant.size, variant.color)]
      .filter(Boolean)
      .join(' ')
      .slice(0, MAX_TITLE)
    const description = plainText(product.description) || product.subtitle || product.title
    const onSale = variant.price < variant.regularPrice
    return [
      '<item>',
      element('g:id', variant.id),
      element('g:item_group_id', product.id),
      element('title', title),
      element('description', description.slice(0, MAX_DESCRIPTION)),
      element('link', absoluteUrl(variant.path)),
      element('g:image_link', image),
      ...additional
        .slice(0, MAX_ADDITIONAL_IMAGES)
        .map((url) => element('g:additional_image_link', url)),
      element('g:price', price(variant.regularPrice)),
      onSale ? element('g:sale_price', price(variant.price)) : '',
      element('g:availability', variant.inStock ? 'in_stock' : 'out_of_stock'),
      element('g:condition', 'new'),
      element('g:brand', product.brand),
      variant.gtin ? element('g:gtin', variant.gtin) : element('g:identifier_exists', 'no'),
      element('g:color', variant.color),
      element('g:size', variant.size),
      element('g:product_type', product.categoryPath.join(' > ')),
      element('g:google_product_category', product.googleCategory),
      variant.shippingCost !== null
        ? `<g:shipping>${element('g:country', config.country)}${element('g:price', price(variant.shippingCost))}</g:shipping>`
        : '',
      '</item>',
    ].join('')
  }

  return function buildMerchantFeed(products: SeoProduct[]): string {
    const items = products.flatMap((product) =>
      product.variants.flatMap((variant) => item(product, variant) ?? []),
    )
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      '<channel>',
      element('title', config.shopTitle),
      element('link', absoluteUrl('/')),
      element('description', config.feedDescription),
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n')
  }
}
