import { renderEmail, resolveOptions } from '@cloud-house/medusa-emails'
import { returnEmailTemplates } from '../templates'

/** The provider's options of a shop called "Acme Shop" (shop names stay in the fixtures, not in the package). */
const emailsOptions = resolveOptions({
  theme: {
    shopName: 'Acme Shop',
    shopNameLocative: 'Acme Shopie',
    colors: { navy: '#0e1b2c' },
    footerLinks: [{ label: 'Terms', url: 'https://shop.example/terms' }],
  },
  templates: returnEmailTemplates,
  apiKey: null,
  from: null,
  mode: 'preview',
})

export const renderReturnEmail = (template: string, data: unknown) =>
  renderEmail(emailsOptions, template, data as Record<string, unknown>)
