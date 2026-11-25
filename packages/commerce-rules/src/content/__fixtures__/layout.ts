import { EMPTY_SELLER } from '../../seller'
import type { LayoutData } from '../layout-types'

/**
 * Domyślne treści layoutu (spec Etapu 1, §6.1) – jedno źródło dla `defaultValue` pól
 * w panelu treści i dla sklepu, gdy treści są niedostępne.
 */
export const DEFAULT_LAYOUT: LayoutData = {
  navigation: [
    { label: 'Deski SUP', href: '/deski-sup' },
    { label: 'Akcesoria', href: '/akcesoria' },
    { label: 'Zestawy', href: '/zestawy' },
    { label: 'Poradnik', href: '/poradnik' },
  ],
  announcement: {
    enabled: true,
    items: [
      { text: 'Darmowa wysyłka od 500 zł' },
      { text: '2 lata gwarancji' },
      { text: '30 dni na zwrot' },
    ],
  },
  footer: {
    tagline:
      'Pompowane deski SUP i akcesoria sprawdzonych marek – Aqua Marina, Gladiator, F2 i innych. Wysyłamy z własnego magazynu.',
    columns: [
      {
        heading: 'Sklep',
        links: [
          { label: 'Deski SUP', href: '/deski-sup' },
          { label: 'Zestawy', href: '/zestawy' },
          { label: 'Akcesoria', href: '/akcesoria' },
          { label: 'Marki', href: '/marki' },
        ],
      },
      {
        heading: 'Pomoc',
        links: [
          { label: 'Dostawa i zwroty', href: '/dostawa-i-zwroty' },
          { label: 'Gwarancja', href: '/gwarancja' },
          { label: 'Kontakt', href: '/kontakt' },
          { label: 'Regulamin', href: '/regulamin' },
        ],
      },
      {
        heading: 'ChoNaSupa',
        links: [
          { label: 'O nas', href: '/o-nas' },
          { label: 'Poradnik', href: '/poradnik' },
          { label: 'Quiz', href: '/quiz' },
          { label: 'Polityka prywatności', href: '/polityka-prywatnosci' },
        ],
      },
    ],
    paymentMethods: 'BLIK · Przelewy24 · Visa · Mastercard',
    newsletter: { enabled: true, heading: 'Zapisz się. Pierwsi dowiesz się o nowych deskach.' },
  },
  settings: {
    freeShippingThreshold: 500,
    shippingCutoff: '14:00',
    returnDays: 30,
    warrantyYears: 2,
    // Danych kontaktowych ani sprzedawcy nie wymyślamy – wpisuje je redaktor w panelu.
    contact: {},
    seller: EMPTY_SELLER,
  },
}
