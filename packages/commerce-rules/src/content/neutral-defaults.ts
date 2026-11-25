import { EMPTY_SELLER } from '../seller'
import type { LayoutData } from './layout-types'

/**
 * Układ sklepu bez żadnych zapisanych treści: pusty header i stopka, wyłączony pasek ogłoszeń.
 * Sklep podaje własne domyślne treści (menu, hasło, linki prawne) przez opcję `defaults` rodzajów.
 */
export const NEUTRAL_LAYOUT: LayoutData = {
  navigation: [],
  announcement: { enabled: false, items: [] },
  footer: {
    tagline: '',
    columns: [],
    paymentMethods: '',
    newsletter: { enabled: true, heading: 'Newsletter' },
  },
  settings: {
    freeShippingThreshold: 0,
    shippingCutoff: '12:00',
    returnDays: 30,
    warrantyYears: 2,
    contact: {},
    seller: EMPTY_SELLER,
  },
}
