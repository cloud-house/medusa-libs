import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { accountEmailTemplates } from '@cloud-house/medusa-accounts'
import { checkoutEmailTemplates } from '@cloud-house/medusa-checkout-pl'
import { invoiceEmailTemplates } from '@cloud-house/medusa-fakturownia'
import { furgonetkaEmailTemplates } from '@cloud-house/medusa-furgonetka'
import { returnEmailTemplates } from '@cloud-house/medusa-returns'
import { defineConfig } from '@medusajs/framework/utils'
import { resolveContact as checkoutContact } from './src/lib/checkout'
import { testContentKinds } from './src/lib/content'
import { resolveOrder, resolveReturn, resolveReturnOrder } from './src/lib/fakturownia'
import {
  resolveContact as furgonetkaContact,
  resolveOrder as furgonetkaOrder,
} from './src/lib/furgonetka'
import { resolveContact, resolveOrder as resolveReturnsOrder } from './src/lib/returns'

module.exports = defineConfig({
  admin: { disable: true },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: '',
      adminCors: '',
      authCors: '',
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: [
    {
      // The e-mail provider of the account e-mails: no Resend key, so every mail lands in `previewDir`.
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: '@cloud-house/medusa-emails/providers/resend',
            id: 'resend',
            options: {
              channels: ['email'],
              mode: 'preview',
              previewDir: join(tmpdir(), 'test-shop-emails'),
              theme: { shopName: 'Test Shop', shopNameLocative: 'Test Shop' },
              templates: [
                ...accountEmailTemplates,
                ...checkoutEmailTemplates,
                ...invoiceEmailTemplates,
                ...returnEmailTemplates,
                ...furgonetkaEmailTemplates,
              ],
            },
          },
        ],
      },
    },
  ],
  // Plugins under test are added here as they are written.
  plugins: [
    {
      resolve: '@cloud-house/medusa-accounts',
      // Fixture values – the plugin has no defaults for the paths. A throttle of 2 keeps the
      // „third request is refused” tests short; the default (3) is covered by unit tests.
      options: {
        paths: {
          confirmEmail: '/confirm-email',
          passwordReset: '/reset-password',
          setPassword: '/set-password',
        },
        storefrontUrl: 'https://shop.test',
        emailThrottle: { max: 2, windowMs: 15 * 60 * 1000 },
        // The HTTP test proves the callbacks run (and with which customer) when an account is deleted.
        onAccountDeleted: [
          async (_container, customerId) => {
            const shared = globalThis as { deletedAccounts?: string[] }
            shared.deletedAccounts = [...(shared.deletedAccounts ?? []), customerId]
          },
        ],
      },
    },
    {
      resolve: '@cloud-house/medusa-checkout-pl',
      // Defaults everywhere except the contact (required) and the log prefix.
      options: { resolveContact: checkoutContact, logPrefix: '[Test]' },
    },
    {
      resolve: '@cloud-house/medusa-content',
      // `CONTENT_PREVIEW_SECRET` and `STOREFRONT_URL` are set by the HTTP test.
      options: { kinds: testContentKinds, logPrefix: '[Test]', mediaFolder: 'test-content' },
    },
    {
      resolve: '@cloud-house/medusa-fakturownia',
      // `FAKTUROWNIA_URL=atrapa` (set by the HTTP test) selects the in-process fake of Fakturownia.
      options: { resolveOrder, resolveReturnOrder, resolveReturn, oidPrefix: 'TEST-' },
    },
    {
      resolve: '@cloud-house/medusa-furgonetka',
      // `FURGONETKA_URL=atrapa` (set by the HTTP test) selects the in-process fake of Furgonetka.
      options: {
        resolveOrder: furgonetkaOrder,
        resolveContact: furgonetkaContact,
        parcelClasses: [
          { key: 'sofa', label: 'Sofa', carriers: ['dpd'] },
          { key: 'lamp', label: 'Lampa', carriers: ['dpd', 'inpost_courier'] },
        ],
        logPrefix: '[Test]',
        referencePrefix: 'TEST',
        senderName: 'Test Shop',
      },
    },
    {
      resolve: '@cloud-house/medusa-returns',
      // Fixture values; the HTTP test shows the paths reach the e-mails.
      options: {
        resolveOrder: resolveReturnsOrder,
        resolveContact,
        logPrefix: '[Test]',
        labelPath: '/returns/label?order=:displayId',
        accountOrderPath: '/account/orders/:id',
      },
    },
    {
      resolve: '@cloud-house/medusa-newsletter',
      // Defaults everywhere except one text: the HTTP test proves plugin options reach the module.
      options: { messages: { adminTitle: 'Newsletter (test-shop)' } },
    },
    {
      resolve: '@cloud-house/medusa-brands',
      // The one non-default option: the HTTP test proves it reaches the module and the routes.
      options: { messages: { adminTitle: 'Brands (test-shop)' } },
    },
    {
      resolve: '@cloud-house/medusa-favorites',
      // The one non-default option: the HTTP test proves the limit reaches the module and the routes.
      options: { limit: 3 },
    },
    {
      resolve: '@cloud-house/medusa-omnibus',
      // The one non-default option: the HTTP test proves it reaches the module and the job's log.
      options: { logPrefix: 'Test' },
    },
  ],
})
