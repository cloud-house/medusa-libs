import { storeNewsletterSubscribeFor } from '../validators'

const body = (source: string) => ({
  email: ' Ola@Example.pl ',
  consent_text: 'Zgoda',
  consent_at: '2026-11-01T10:00:00.000Z',
  source,
})

describe('storeNewsletterSubscribeFor', () => {
  it('accepts only the sources of the options', () => {
    const schema = storeNewsletterSubscribeFor(['footer'])
    expect(schema.parse(body('footer'))).toMatchObject({
      email: 'ola@example.pl',
      source: 'footer',
    })
    expect(schema.safeParse(body('checkout')).success).toBe(false)
    expect(schema.safeParse(body('popup')).success).toBe(false)
  })

  it('builds the schema once per sources list', () => {
    const sources = ['footer', 'home'] as const
    expect(storeNewsletterSubscribeFor(sources)).toBe(storeNewsletterSubscribeFor(sources))
  })
})
