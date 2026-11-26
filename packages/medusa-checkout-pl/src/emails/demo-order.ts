import type { OrderPlacedEmailData } from './types'

const MEDIA = 'http://shop.example/media/demo'

/** The order from the approved mock-up (`mail-potwierdzenie.html`) – for tests and `email:preview`. */
export function orderPlacedData(over: Partial<OrderPlacedEmailData> = {}): OrderPlacedEmailData {
  return {
    displayId: 1001,
    placedAt: '19 października 2026',
    firstName: 'Jan',
    groups: [
      {
        line: {
          title: 'Allround Wave',
          variant: `Turkus · 10'6"`,
          thumbnail: `${MEDIA}/allround-wave-turkus-glowne-01M52SF7M35DS2BVH3J4ZFB3SC.webp`,
          quantity: 1,
          total: 1899,
          originalTotal: 1899,
          discountLabel: null,
          replaces: null,
        },
        upgrades: [
          {
            title: 'Wiosło Carbon Pro',
            variant: null,
            thumbnail: `${MEDIA}/wioslo-carbon-pro-01M52SFB0H9HH9V9759YJV0KBR.webp`,
            quantity: 1,
            total: 449.4,
            originalTotal: 749,
            discountLabel: 'Rabat zestawowy',
            replaces: 'Wiosło alu 3-cz.',
          },
        ],
      },
    ],
    totals: {
      products: 2648,
      discounts: 299.6,
      shipping: 0,
      shippingMethod: 'Kurier InPost',
      total: 2348.4,
      tax: 439.13,
    },
    delivery: {
      method: 'Kurier InPost',
      lines: ['Jan Kowalski', 'ul. Morska 5', '80-001 Gdańsk', 'tel. +48 600 100 200'],
      note: null,
    },
    invoice: {
      company: 'Sup Sp. z o.o.',
      nip: '5260250274',
      lines: ['ul. Morska 5', '80-001 Gdańsk'],
    },
    customerNote: 'Proszę dzwonić przed dostawą – domofon nie działa.',
    contact: {
      canReply: true,
      email: 'sklep@shop.example',
      phone: '+48 600 100 200',
      hours: 'pon.–pt. 9–17',
    },
    seller: 'Acme Shop sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274',
    shopUrl: 'https://shop.example',
    ...over,
  }
}
