import type { HttpTypes } from '@medusajs/types'

const MEDIA = 'https://shop.example/media'

export const BOARD_VARIANT = 'variant_wave_turkus_106'
export const PADDLE_VARIANT = 'variant_paddle'
export const VEST_VARIANT = 'variant_vest_lxl'

interface LineInput {
  id: string
  variantId: string
  handle: string
  title: string
  variantTitle: string
  quantity?: number
  originalTotal: number
  total?: number
  codes?: string[]
  metadata?: Record<string, string>
  createdAt: string
}

function line(input: LineInput): HttpTypes.StoreCartLineItem {
  return {
    id: input.id,
    variant_id: input.variantId,
    product_handle: input.handle,
    product_title: input.title,
    thumbnail: `${MEDIA}/${input.handle}.webp`,
    quantity: input.quantity ?? 1,
    metadata: input.metadata ?? null,
    created_at: input.createdAt,
    original_total: input.originalTotal,
    total: input.total ?? input.originalTotal,
    adjustments: (input.codes ?? []).map((code, i) => ({ id: `adj_${input.id}_${i}`, code })),
    variant_title: input.variantTitle,
  } as unknown as HttpTypes.StoreCartLineItem
}

export const boardLine = line({
  id: 'item_board',
  variantId: BOARD_VARIANT,
  handle: 'allround-wave',
  title: 'Allround Wave',
  variantTitle: `10'6" / Turkus`,
  originalTotal: 1899,
  createdAt: '2026-10-19T10:00:00.000Z',
})

export const paddleUpgradeLine = line({
  id: 'item_paddle',
  variantId: PADDLE_VARIANT,
  handle: 'wioslo-carbon-pro',
  title: 'Wiosło Carbon Pro',
  variantTitle: 'Regulowane 170–210 cm',
  originalTotal: 749,
  total: 449.4,
  codes: ['WIOSLO-Z-DESKA'],
  metadata: { upgrade_of: BOARD_VARIANT, replaces: 'Wiosło alu 3-cz.' },
  createdAt: '2026-10-19T10:00:01.000Z',
})

export const vestLine = line({
  id: 'item_vest',
  variantId: VEST_VARIANT,
  handle: 'kamizelka-float-50n',
  title: 'Kamizelka Float 50N',
  variantTitle: 'L/XL',
  originalTotal: 249,
  total: 224.1,
  codes: ['WIOSNA10'],
  createdAt: '2026-10-19T10:05:00.000Z',
})

/**
 * Kolor i rozmiar wariantów z katalogu (koszyk Medusy nie zwraca opcji wariantu), marka
 * i kategoria do zdarzeń analityki – kamizelka bez nich (produkt spoza katalogu).
 */
export const TEST_VARIANT_OPTIONS = {
  [BOARD_VARIANT]: { size: `10'6"`, color: 'Turkus', brand: 'Aqua Marina', category: 'Allround' },
  [PADDLE_VARIANT]: {
    size: 'Regulowane 170–210 cm',
    color: null,
    brand: 'Aqua Marina',
    category: 'Wiosła',
  },
  [VEST_VARIANT]: { size: 'L/XL', color: null },
}

const PROMOTIONS = [
  { id: 'promo_bundle', code: 'WIOSLO-Z-DESKA', is_automatic: true },
  { id: 'promo_code', code: 'WIOSNA10', is_automatic: false },
]

/** Koszyk: deska z wiosłem-zamiennikiem (rabat zestawowy) i kamizelka z kodem WIOSNA10. */
export function testCart(over: Partial<HttpTypes.StoreCart> = {}): HttpTypes.StoreCart {
  return {
    id: 'cart_test',
    // Kolejność z Medusy bywa dowolna – widok sortuje po `created_at`.
    items: [paddleUpgradeLine, vestLine, boardLine],
    original_item_total: 2897,
    item_total: 2572.5,
    total: 2572.5,
    promotions: PROMOTIONS,
    ...over,
  } as unknown as HttpTypes.StoreCart
}

/** Samo wiosło z `upgrade_of`, bez deski i bez rabatu (deskę usunięto). */
export function orphanCart(): HttpTypes.StoreCart {
  const paddle = { ...paddleUpgradeLine, total: 749, adjustments: [] }
  return testCart({
    items: [paddle] as HttpTypes.StoreCartLineItem[],
    original_item_total: 749,
    item_total: 749,
    total: 749,
    promotions: [],
  })
}
