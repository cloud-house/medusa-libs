import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { NEWSLETTER_MODULE } from '..'
import { NewsletterSubscriber } from '../models/newsletter-subscriber'
import type NewsletterModuleService from '../service'

jest.setTimeout(60 * 1000)

// Medusa passes `moduleOptions` the way it passes a plugin's `options` to the plugin's modules.
moduleIntegrationTestRunner<NewsletterModuleService>({
  moduleName: NEWSLETTER_MODULE,
  moduleModels: [NewsletterSubscriber],
  resolve: './src/modules/newsletter',
  moduleOptions: { locale: 'en', messages: { unauthorized: 'Nope.' } },
  testSuite: ({ service }) => {
    describe('NewsletterModuleService', () => {
      it('gets the module options, defaults filled in', () => {
        const options = service.getOptions()
        expect(options.locale).toBe('en')
        expect(options.messages.unauthorized).toBe('Nope.')
        expect(options.messages.alreadySubscribed).toBe('This address is already subscribed.')
        expect(options.storefrontSecret).toEqual({
          header: 'x-storefront-secret',
          env: 'STOREFRONT_API_SECRET',
        })
      })

      it('keeps one sign-up per address', async () => {
        const consent = { consent_text: 'Zgoda', consent_at: new Date(), source: 'footer' as const }
        await service.createNewsletterSubscribers({ email: 'ola@example.pl', ...consent })
        await expect(
          service.createNewsletterSubscribers({ email: 'ola@example.pl', ...consent }),
        ).rejects.toThrow()
      })
    })
  },
})

moduleIntegrationTestRunner<NewsletterModuleService>({
  moduleName: NEWSLETTER_MODULE,
  moduleModels: [NewsletterSubscriber],
  resolve: './src/modules/newsletter',
  testSuite: ({ service }) => {
    describe('NewsletterModuleService without options', () => {
      it('falls back to Polish and the default secret', () => {
        const options = service.getOptions()
        expect(options.locale).toBe('pl')
        expect(options.messages.alreadySubscribed).toBe('Ten adres jest już zapisany.')
        expect(options.storefrontSecret.header).toBe('x-storefront-secret')
      })
    })
  },
})
