import { FAKE_URL, furgonetkaConfig, furgonetkaWarnings } from '../config'

const SANDBOX = 'https://api.sandbox.furgonetka.pl'

const credentials = { FURGONETKA_CLIENT_ID: 'app-1', FURGONETKA_CLIENT_SECRET: 'sec-1' }

describe('furgonetkaConfig', () => {
  it('is off without FURGONETKA_URL', () => {
    expect(furgonetkaConfig({})).toBeNull()
    expect(furgonetkaConfig({ FURGONETKA_URL: '  ' })).toBeNull()
  })

  it('is off when the API address comes without the application data', () => {
    expect(furgonetkaConfig({ FURGONETKA_URL: SANDBOX })).toBeNull()
    expect(furgonetkaConfig({ FURGONETKA_URL: SANDBOX, FURGONETKA_CLIENT_ID: 'app-1' })).toBeNull()
    expect(
      furgonetkaConfig({ FURGONETKA_URL: SANDBOX, FURGONETKA_CLIENT_SECRET: 'sec-1' }),
    ).toBeNull()
  })

  it('talks to the API with an address and the application data', () => {
    expect(furgonetkaConfig({ FURGONETKA_URL: `${SANDBOX}/`, ...credentials })).toEqual({
      client: 'api',
      url: SANDBOX,
      clientId: 'app-1',
      clientSecret: 'sec-1',
      webhookToken: null,
      pickupHours: { from: '10:00', to: '15:00' },
      pickupTodayUntil: '12:00',
      adminUrl: null,
    })
  })

  it('takes the webhook token, the pickup settings and the admin address from env', () => {
    expect(
      furgonetkaConfig({
        FURGONETKA_URL: SANDBOX,
        ...credentials,
        FURGONETKA_WEBHOOK_TOKEN: ' hook-1 ',
        FURGONETKA_PICKUP_HOURS: '09:00-14:30',
        FURGONETKA_PICKUP_TODAY_UNTIL: '11:15',
        MEDUSA_ADMIN_URL: 'https://api.shop.example/app/',
      }),
    ).toMatchObject({
      webhookToken: 'hook-1',
      pickupHours: { from: '09:00', to: '14:30' },
      pickupTodayUntil: '11:15',
      adminUrl: 'https://api.shop.example/app',
    })
  })

  it('uses the in-process fake for „atrapa” outside production', () => {
    expect(FAKE_URL).toBe('atrapa')
    expect(furgonetkaConfig({ FURGONETKA_URL: 'atrapa' })).toEqual({
      client: 'fake',
      url: null,
      clientId: null,
      clientSecret: null,
      webhookToken: 'atrapa',
      pickupHours: { from: '10:00', to: '15:00' },
      pickupTodayUntil: '12:00',
      adminUrl: null,
    })
  })

  it('never uses the fake in production', () => {
    const env = { FURGONETKA_URL: 'atrapa', NODE_ENV: 'production' }
    expect(furgonetkaConfig(env)).toBeNull()
    expect(furgonetkaWarnings(env)).toEqual([
      'Furgonetka: FURGONETKA_URL=atrapa w produkcji – Furgonetka jest wyłączona.',
    ])
  })

  it('falls back to the default pickup hours and warns about a wrong format', () => {
    for (const hours of ['9-15', '10:00', '10:00-25:00', '15:00-10:00', '10:00-10:00']) {
      const env = { FURGONETKA_URL: 'atrapa', FURGONETKA_PICKUP_HOURS: hours }
      expect(furgonetkaConfig(env)?.pickupHours).toEqual({ from: '10:00', to: '15:00' })
      expect(furgonetkaWarnings(env)).toEqual([
        `Furgonetka: FURGONETKA_PICKUP_HOURS="${hours}" – oczekiwany format HH:MM-HH:MM, początek przed końcem; przyjmuję 10:00-15:00.`,
      ])
    }
  })

  it('falls back to the default „today until” hour and warns about a wrong format', () => {
    const env = { FURGONETKA_URL: 'atrapa', FURGONETKA_PICKUP_TODAY_UNTIL: '12' }
    expect(furgonetkaConfig(env)?.pickupTodayUntil).toBe('12:00')
    expect(furgonetkaWarnings(env)).toEqual([
      'Furgonetka: FURGONETKA_PICKUP_TODAY_UNTIL="12" – oczekiwany format HH:MM; przyjmuję 12:00.',
    ])
  })
})

describe('furgonetkaWarnings', () => {
  it('warns about an address without the application data', () => {
    expect(furgonetkaWarnings({ FURGONETKA_URL: SANDBOX })).toEqual([
      'Furgonetka: FURGONETKA_URL bez FURGONETKA_CLIENT_ID i FURGONETKA_CLIENT_SECRET – Furgonetka jest wyłączona.',
    ])
  })

  it('warns when the API is used without the webhook token', () => {
    expect(furgonetkaWarnings({ FURGONETKA_URL: SANDBOX, ...credentials })).toEqual([
      'Furgonetka: brak FURGONETKA_WEBHOOK_TOKEN – webhook Furgonetki odpowiada 404, statusy czyta tylko zadanie co 15 minut.',
    ])
  })

  it('stays quiet for a complete setup, for the fake and without Furgonetka', () => {
    expect(
      furgonetkaWarnings({
        FURGONETKA_URL: SANDBOX,
        ...credentials,
        FURGONETKA_WEBHOOK_TOKEN: 'hook-1',
      }),
    ).toEqual([])
    expect(furgonetkaWarnings({ FURGONETKA_URL: 'atrapa' })).toEqual([])
    expect(furgonetkaWarnings({})).toEqual([])
  })
})

describe('furgonetkaWarnings prefix', () => {
  it('starts every warning with the prefix the shop gives', () => {
    const warnings = furgonetkaWarnings(
      {
        FURGONETKA_URL: 'https://api.furgonetka.pl',
        FURGONETKA_CLIENT_ID: 'id',
        FURGONETKA_CLIENT_SECRET: 's',
      },
      'Acme Shop:',
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^Acme Shop: brak FURGONETKA_WEBHOOK_TOKEN/)
  })
})
