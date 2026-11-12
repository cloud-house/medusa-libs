import { afterEach, describe, expect, it, vi } from 'vitest'
import { medusaEnv } from './env'
import { StoreUnavailableError } from './errors'

describe('medusaEnv', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('throws StoreUnavailableError with the given message when the key is missing', () => {
    vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', '')
    expect(() => medusaEnv({ missingKeyMessage: 'Brak klucza.' })).toThrow(StoreUnavailableError)
    expect(() => medusaEnv({ missingKeyMessage: 'Brak klucza.' })).toThrow('Brak klucza.')
  })

  it('has a default message', () => {
    vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', '')
    expect(() => medusaEnv()).toThrow(/MEDUSA_PUBLISHABLE_KEY/)
  })

  it('reads the env and falls back to the default backend url', () => {
    vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_1')
    vi.stubEnv('MEDUSA_BACKEND_URL', '')
    delete process.env.MEDUSA_BACKEND_URL
    expect(medusaEnv()).toEqual({ backendUrl: 'http://localhost:9000', publishableKey: 'pk_1' })
    expect(medusaEnv({ defaultBackendUrl: 'http://localhost:9100' }).backendUrl).toBe(
      'http://localhost:9100',
    )
    vi.stubEnv('MEDUSA_BACKEND_URL', 'https://api.example.com')
    expect(medusaEnv().backendUrl).toBe('https://api.example.com')
  })
})
