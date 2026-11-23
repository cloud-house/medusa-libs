import { resolve } from 'node:path'
import { emailEnv, emailWarnings } from '../env'

describe('emailEnv', () => {
  it('sends with a key and a sender', () => {
    expect(
      emailEnv({
        RESEND_API_KEY: 're_test',
        EMAIL_FROM: 'Acme <orders@example.com>',
        EMAIL_REPLY_TO: 'shop@example.com',
      }),
    ).toEqual({
      apiKey: 're_test',
      from: 'Acme <orders@example.com>',
      replyTo: 'shop@example.com',
      previewDir: resolve('.emails'),
      mode: 'send',
    })
  })

  it('previews without a key', () => {
    expect(emailEnv({ EMAIL_FROM: 'Acme <orders@example.com>' })).toMatchObject({
      apiKey: null,
      mode: 'preview',
    })
  })

  it('previews when the key comes without a sender', () => {
    expect(emailEnv({ RESEND_API_KEY: 're_test' })).toMatchObject({ from: null, mode: 'preview' })
  })

  it('takes the preview directory from EMAIL_PREVIEW_DIR', () => {
    expect(emailEnv({ EMAIL_PREVIEW_DIR: '/tmp/mails' }).previewDir).toBe('/tmp/mails')
  })

  it('in production writes no preview files unless EMAIL_PREVIEW_DIR is set', () => {
    expect(emailEnv({ NODE_ENV: 'production' }).previewDir).toBeNull()
    expect(emailEnv({ NODE_ENV: 'production', EMAIL_PREVIEW_DIR: '/var/mails' }).previewDir).toBe(
      '/var/mails',
    )
  })
})

describe('emailWarnings', () => {
  it('warns without a key and with a key but no sender, using the given prefix', () => {
    expect(emailWarnings({}, 'Acme')).toEqual([
      'Acme: brak RESEND_API_KEY – e-maile z potwierdzeniem nie wychodzą do klientów (tylko podgląd).',
    ])
    expect(emailWarnings({ RESEND_API_KEY: 're_x' }, 'Acme')).toEqual([
      'Acme: RESEND_API_KEY bez EMAIL_FROM – e-maile z potwierdzeniem nie wychodzą do klientów (tylko podgląd).',
    ])
    expect(
      emailWarnings({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'Acme <a@example.com>' }, 'Acme'),
    ).toEqual([])
  })
})
