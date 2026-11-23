import { renderEmail, resolveOptions } from '@cloud-house/medusa-emails'
import { invoiceEmailTemplates } from '../templates'

/** The provider's options of a shop called "Acme Shop" (shop names stay in the fixtures, not in the package). */
const emailsOptions = resolveOptions({
  theme: {
    shopName: 'Acme Shop',
    shopNameLocative: 'Acme Shopie',
    colors: { navy: '#0e1b2c' },
    footerLinks: [{ label: 'Terms', url: 'https://shop.example/terms' }],
  },
  templates: invoiceEmailTemplates,
  apiKey: null,
  from: null,
  mode: 'preview',
})

export const renderInvoiceEmail = (template: string, data: unknown) =>
  renderEmail(emailsOptions, template, data as Record<string, unknown>)

export const flat = (text: string) => text.replace(/\s+/g, ' ')
