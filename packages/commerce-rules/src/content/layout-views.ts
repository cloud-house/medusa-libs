import { type SellerInfo, toSellerInfo } from '../seller'
import type { LayoutData, NavLink } from './layout-types'
import { NEUTRAL_LAYOUT } from './neutral-defaults'

/** Wiersze tablic mogą mieć `id` (w domyślnych treściach go nie ma). */
type Rows<T> = (T & { id?: string | null })[] | null | undefined

/** Surowe dokumenty globali układu; `null` = odczyt się nie udał. */
export interface RawLayoutGlobals {
  header: { navigation?: Rows<{ label: string; href: string }> } | null
  announcement: {
    enabled?: boolean | null
    items?: Rows<{ text: string; href?: string | null }>
  } | null
  footer: {
    tagline?: string | null
    columns?: Rows<{ heading: string; links?: Rows<{ label: string; href: string }> }>
    paymentMethods?: string | null
    newsletter?: { enabled?: boolean | null; heading?: string | null } | null
  } | null
  settings: {
    freeShippingThreshold?: number | null
    shippingCutoff?: string | null
    returnDays?: number | null
    warrantyYears?: number | null
    contactEmail?: string | null
    contactPhone?: string | null
    contactHours?: string | null
    instagramUrl?: string | null
    seller?: { [K in keyof SellerInfo]?: string | null } | null
  } | null
}

const toLinks = (rows: Rows<{ label: string; href: string }>): NavLink[] =>
  (rows ?? []).map(({ id, label, href }) => ({ id: id ?? undefined, label, href }))

/** Pusty tekst z panelu traktujemy jak brak wartości. */
const optional = (value: string | null | undefined): string | undefined =>
  value?.trim() ? value.trim() : undefined

export function resolveLayoutData(
  raw: RawLayoutGlobals,
  defaults: LayoutData = NEUTRAL_LAYOUT,
): LayoutData {
  const navigation = toLinks(raw.header?.navigation)

  return {
    navigation: navigation.length > 0 ? navigation : defaults.navigation,
    announcement: raw.announcement
      ? {
          enabled: raw.announcement.enabled ?? true,
          items: (raw.announcement.items ?? []).map(({ id, text, href }) => ({
            id: id ?? undefined,
            text,
            href: optional(href),
          })),
        }
      : defaults.announcement,
    footer: raw.footer
      ? {
          tagline: optional(raw.footer.tagline) ?? '',
          columns: (raw.footer.columns ?? [])
            .map(({ id, heading, links }) => ({
              id: id ?? undefined,
              heading,
              links: toLinks(links),
            }))
            .filter((column) => column.links.length > 0),
          paymentMethods: raw.footer.paymentMethods ?? '',
          newsletter: {
            // Stary dokument stopki nie ma tej grupy – zapis na newsletter jest wtedy włączony.
            enabled: raw.footer.newsletter?.enabled ?? true,
            heading: optional(raw.footer.newsletter?.heading) ?? defaults.footer.newsletter.heading,
          },
        }
      : defaults.footer,
    settings: raw.settings
      ? {
          freeShippingThreshold:
            raw.settings.freeShippingThreshold ?? defaults.settings.freeShippingThreshold,
          shippingCutoff: raw.settings.shippingCutoff ?? defaults.settings.shippingCutoff,
          returnDays: raw.settings.returnDays ?? defaults.settings.returnDays,
          warrantyYears: raw.settings.warrantyYears ?? defaults.settings.warrantyYears,
          contact: {
            email: optional(raw.settings.contactEmail),
            phone: optional(raw.settings.contactPhone),
            hours: optional(raw.settings.contactHours),
          },
          instagramUrl: optional(raw.settings.instagramUrl),
          seller: toSellerInfo(raw.settings.seller),
        }
      : defaults.settings,
  }
}

/**
 * Cart value the shop promises free delivery from („Darmowa dostawa od X”): the highest `free_from`
 * of the shipping methods, so the promise holds whichever method the order needs (boards travel
 * only by DPD courier). `null` – no method is ever free.
 */
export function freeShippingFrom(rates: { free_from: number | null }[]): number | null {
  const values = rates
    .map((rate) => rate.free_from)
    .filter((value): value is number => typeof value === 'number')
  return values.length ? Math.max(...values) : null
}
