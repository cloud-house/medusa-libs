import {
  type LayoutData,
  validateOptionalNip,
  validatePostalCode,
  validateTime,
} from '@cloud-house/commerce-rules'
import { z } from '@medusajs/framework/zod'
import type { ContentKind } from '../kinds'
import { checked, optionalText } from './common'
import { optionalHref } from './layout'

/**
 * Store settings – read by the shop and by Medusa itself (e-mails, returns policy). The free
 * shipping threshold is not here: it comes from the shipping option's price rule.
 */
export const StoreSettingsSchema = z.object({
  shippingCutoff: checked(z.string(), (value) => validateTime(value)),
  returnDays: z.number().int().min(14, 'Na zwrot są co najmniej 14 dni.'),
  warrantyYears: z.number().int().min(2, 'Gwarancja trwa co najmniej 2 lata.'),
  contactEmail: optionalText.refine(
    (value) => !value || z.email().safeParse(value).success,
    'Podaj poprawny adres e-mail.',
  ),
  contactPhone: optionalText,
  contactHours: optionalText,
  instagramUrl: optionalHref,
  seller: z
    .object({
      companyName: optionalText,
      street: optionalText,
      postalCode: checked(optionalText, (value) => validatePostalCode(value)),
      city: optionalText,
      nip: checked(optionalText, (value) => validateOptionalNip(value)),
      regon: optionalText,
      registry: optionalText,
      returnAddress: optionalText,
    })
    .partial()
    .default({}),
})

/** Every published change is a version (proof of the returns policy that applied on a date). */
export function storeSettingsKind(
  options: { defaults?: LayoutData['settings'] } = {},
): ContentKind {
  return {
    type: 'global',
    slug: 'store-settings',
    label: 'Ustawienia sklepu',
    schema: StoreSettingsSchema,
    versions: { drafts: false, maxVersions: 0 },
    defaults: options.defaults,
  }
}
