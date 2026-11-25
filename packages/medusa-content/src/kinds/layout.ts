import {
  type AnnouncementItem,
  type FooterColumn,
  type LayoutData,
  type NavLink,
  validateHref,
} from '@cloud-house/commerce-rules'
import { z } from '@medusajs/framework/zod'
import type { ContentKind } from '../kinds'
import type { EntryData } from '../types'
import { checked, optionalText, requiredText } from './common'

const href = checked(z.string(), (value) => validateHref(value))
export const optionalHref = checked(optionalText, (value) =>
  validateHref(value, { required: false }),
)
const link = z.object({ label: requiredText('Podaj tekst linku.'), href })

export const HeaderSchema = z.object({
  navigation: z
    .array(link)
    .min(1, 'Menu ma co najmniej jedną pozycję.')
    .max(6, 'Menu: najwyżej 6 pozycji.'),
})

export const AnnouncementBarSchema = z.object({
  enabled: z.boolean().default(false),
  items: z
    .array(z.object({ text: requiredText('Podaj treść komunikatu.'), href: optionalHref }))
    .max(4, 'Najwyżej 4 komunikaty.')
    .default([]),
})

export const FooterSchema = z.object({
  tagline: optionalText.refine((value) => (value ?? '').length <= 200, 'Najwyżej 200 znaków.'),
  columns: z
    .array(
      z.object({
        heading: requiredText('Podaj nagłówek kolumny.'),
        links: z
          .array(link)
          .min(1, 'Kolumna ma co najmniej jeden link.')
          .max(8, 'Najwyżej 8 linków.'),
      }),
    )
    .min(1, 'Stopka ma co najmniej jedną kolumnę.')
    .max(4, 'Najwyżej 4 kolumny.'),
  newsletter: z
    .object({
      enabled: z.boolean().default(true),
      heading: optionalText.refine((value) => (value ?? '').length <= 120, 'Najwyżej 120 znaków.'),
    })
    .default({ enabled: true, heading: null }),
  paymentMethods: optionalText,
})

/** `defaults`: what the store shows until the global is saved (`LayoutData` of commerce-rules). */
export function headerKind(options: { defaults?: NavLink[] } = {}): ContentKind {
  return {
    type: 'global',
    slug: 'header',
    label: 'Nagłówek',
    schema: HeaderSchema,
    defaults: options.defaults,
    initial: { navigation: options.defaults ?? [] },
  }
}

export function announcementBarKind(
  options: { defaults?: LayoutData['announcement'] } = {},
): ContentKind {
  return {
    type: 'global',
    slug: 'announcement-bar',
    label: 'Pasek ogłoszeń',
    schema: AnnouncementBarSchema,
    defaults: options.defaults,
    initial: (options.defaults ?? { enabled: false, items: [] }) as EntryData,
  }
}

export function footerKind(options: { defaults?: LayoutData['footer'] } = {}): ContentKind {
  return {
    type: 'global',
    slug: 'footer',
    label: 'Stopka',
    schema: FooterSchema,
    defaults: options.defaults,
    initial: options.defaults as EntryData | undefined,
  }
}

export type { AnnouncementItem, FooterColumn }
