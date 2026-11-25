import { formatPrice } from '../format-price'
import { pluralizePl } from '../pluralize'
import { returnAddressText } from '../seller'
import type { LayoutData } from './layout-types'
import { SETTING_VALUE_OPTIONS, type SettingValueKey } from './setting-keys'

export type SettingValue =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'missing'; text: string }

const SELLER_MISSING = '[uzupełnij dane sprzedawcy]'

const missing = (key: SettingValueKey): SettingValue => {
  const label = SETTING_VALUE_OPTIONS.find((option) => option.value === key)?.label ?? key
  return { kind: 'missing', text: `[uzupełnij: ${label.toLowerCase()}]` }
}

const text = (value: string | null | undefined, key: SettingValueKey): SettingValue =>
  value ? { kind: 'text', text: value } : missing(key)

/** Wartość z Ustawień sklepu wstawiona w treść strony – z jednostką, odmianą albo jako link. */
export function settingValue(key: SettingValueKey, settings: LayoutData['settings']): SettingValue {
  switch (key) {
    case 'freeShippingThreshold':
      return { kind: 'text', text: formatPrice(settings.freeShippingThreshold) }
    case 'shippingCutoff':
      return text(settings.shippingCutoff, key)
    case 'returnDays': {
      const days = settings.returnDays
      return { kind: 'text', text: `${days} ${pluralizePl(days, ['dzień', 'dni', 'dni'])}` }
    }
    case 'warrantyYears': {
      const years = settings.warrantyYears
      return { kind: 'text', text: `${years} ${pluralizePl(years, ['rok', 'lata', 'lat'])}` }
    }
    case 'contactEmail': {
      const email = settings.contact.email
      return email ? { kind: 'link', text: email, href: `mailto:${email}` } : missing(key)
    }
    case 'contactPhone': {
      const phone = settings.contact.phone
      return phone
        ? { kind: 'link', text: phone, href: `tel:${phone.replace(/[^\d+]/g, '')}` }
        : missing(key)
    }
    case 'contactHours':
      return text(settings.contact.hours, key)
    case 'sellerName':
      return settings.seller.companyName
        ? { kind: 'text', text: settings.seller.companyName }
        : { kind: 'missing', text: SELLER_MISSING }
    case 'returnAddress': {
      const address = returnAddressText(settings.seller)
      return address ? { kind: 'text', text: address } : { kind: 'missing', text: SELLER_MISSING }
    }
  }
}
