import type { OrderSummary, OrderSummaryItem } from '@cloud-house/commerce-rules'
import { BOARD_VARIANT, PADDLE_VARIANT } from '../cart/test-cart'

const item = (over: Partial<OrderSummaryItem> & { id: string }): OrderSummaryItem => ({
  variant_id: null,
  title: 'Standard',
  product_title: null,
  product_handle: null,
  variant_title: null,
  thumbnail: null,
  quantity: 1,
  total: 0,
  original_total: 0,
  metadata: null,
  ...over,
})

const address = {
  first_name: 'Jan',
  last_name: 'Kowalski',
  company: null,
  address_1: 'ul. Morska 5',
  address_2: null,
  postal_code: '80-001',
  city: 'Gdańsk',
  country_code: 'pl',
  phone: '+48600100200',
}

/** Zamówienie: deska z wiosłem (rabat zestawowy) i kamizelka, kurier DPD, opłacone. */
export function testOrder(over: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 'order_1',
    display_id: 1001,
    email: 'jan@example.pl',
    created_at: '2026-10-19T10:00:00.000Z',
    payment_status: 'captured',
    items: [
      item({
        id: 'oi_board',
        variant_id: BOARD_VARIANT,
        product_title: 'Allround Wave',
        product_handle: 'allround-wave',
        total: 1899,
        original_total: 1899,
      }),
      item({
        id: 'oi_vest',
        variant_id: 'variant_vest_lxl',
        product_title: 'Kamizelka Aqua',
        product_handle: 'kamizelka-aqua',
        variant_title: 'L/XL',
        total: 199,
        original_total: 199,
      }),
      item({
        id: 'oi_paddle',
        variant_id: PADDLE_VARIANT,
        product_title: 'Wiosło Carbon Pro',
        product_handle: 'wioslo-carbon-pro',
        total: 449.4,
        original_total: 749,
        metadata: { upgrade_of: BOARD_VARIANT, replaces: 'Wiosło alu 3-cz.' },
      }),
    ],
    item_total: 2547.4,
    original_item_total: 2847,
    shipping_total: 0,
    tax_total: 476.35,
    total: 2547.4,
    shipping_address: address,
    billing_address: address,
    shipping_method: { name: 'Kurier DPD', code: 'kurier-dpd', amount: 0, data: {} },
    metadata: { terms_accepted_at: '2026-10-19T10:00:00.000Z' },
    codes: [],
    ...over,
  }
}
