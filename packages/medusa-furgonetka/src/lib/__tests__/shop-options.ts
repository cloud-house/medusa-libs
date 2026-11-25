/**
 * The `furgonetka` module service of a test container: the options of a shop called "Acme Shop"
 * (prefix `[Shop]`, two bulky classes). `contact` is what `resolveContact` answers.
 */
export const SHOP_PREFIX = '[Shop]'

export function furgonetkaService(
  contact: unknown = { email: 'kontakt@shop.example', phone: null, hours: null, seller: null },
  extra: Record<string, unknown> = {},
) {
  return {
    getOptions: () => ({
      resolveOrder: async () => null,
      resolveContact: async () => {
        if (contact instanceof Error) throw contact
        return contact
      },
      parcelClasses: [
        { key: 'board', label: 'Deska', carriers: ['dpd'] },
        { key: 'courier_only', label: 'Tylko kurier', carriers: ['dpd'] },
      ],
      resolveParcelClasses: async () => new Map(),
      deliveryCodes: { inpostCourier: 'kurier-inpost', inpostLocker: 'paczkomat-inpost' },
      senderName: 'Acme Shop',
      stockLocationName: null,
      logPrefix: SHOP_PREFIX,
      accountOrderPath: '/konto/zamowienia/:id',
      ...extra,
    }),
  }
}
