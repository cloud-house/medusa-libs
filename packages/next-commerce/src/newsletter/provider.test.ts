import type { Resend } from 'resend'
import { describe, expect, it, vi } from 'vitest'
import { fakeNewsletterProvider, resendNewsletterProvider } from './provider'

describe('fakeNewsletterProvider', () => {
  it('collects added emails', async () => {
    const provider = fakeNewsletterProvider()
    await provider.add('test1@example.com')
    await provider.add('test2@example.com')
    expect(provider.calls).toEqual(['test1@example.com', 'test2@example.com'])
  })
})

describe('resendNewsletterProvider', () => {
  it('returns null when API key or audience ID is missing', () => {
    expect(resendNewsletterProvider({})).toBeNull()
    expect(resendNewsletterProvider({ NEWSLETTER_API_KEY: 'key' })).toBeNull()
    expect(resendNewsletterProvider({ NEWSLETTER_AUDIENCE_ID: 'aud' })).toBeNull()
  })

  it('calls resend.contacts.create when configured', async () => {
    const createMock = vi.fn().mockResolvedValue({ data: { id: 'cnt_123' }, error: null })
    const fakeClient = {
      contacts: {
        create: createMock,
      },
    } as unknown as Resend

    const provider = resendNewsletterProvider(
      {
        NEWSLETTER_API_KEY: 'test-key',
        NEWSLETTER_AUDIENCE_ID: 'test-aud',
      },
      fakeClient,
    )

    expect(provider).not.toBeNull()
    await provider?.add('hello@example.com')

    expect(createMock).toHaveBeenCalledWith({
      audienceId: 'test-aud',
      email: 'hello@example.com',
      unsubscribed: false,
    })
  })

  it('does not throw when contacts.create returns an error', async () => {
    const createMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Failed to add contact', name: 'validation_error' },
    })
    const fakeClient = {
      contacts: {
        create: createMock,
      },
    } as unknown as Resend

    const provider = resendNewsletterProvider(
      {
        NEWSLETTER_API_KEY: 'test-key',
        NEWSLETTER_AUDIENCE_ID: 'test-aud',
      },
      fakeClient,
    )

    await expect(provider?.add('error@example.com')).resolves.toBeUndefined()
  })

  it('does not throw when contacts.create throws an exception', async () => {
    const createMock = vi.fn().mockRejectedValue(new Error('Network offline'))
    const fakeClient = {
      contacts: {
        create: createMock,
      },
    } as unknown as Resend

    const provider = resendNewsletterProvider(
      {
        NEWSLETTER_API_KEY: 'test-key',
        NEWSLETTER_AUDIENCE_ID: 'test-aud',
      },
      fakeClient,
    )

    await expect(provider?.add('throw@example.com')).resolves.toBeUndefined()
  })
})
