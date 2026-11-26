import type { CheckoutContact } from '@cloud-house/medusa-checkout-pl'

/** The test shop's `resolveContact` of the checkout plugin (the order e-mail footer). */
export const resolveContact = async (): Promise<CheckoutContact> => ({
  email: 'contact@shop.test',
  phone: '+48 600 100 200',
  hours: 'Mon–Fri 9–17',
  seller: 'Test Shop sp. z o.o., ul. Portowa 3, 80-002 Gdańsk',
})
