import { describe, expect, it, vi } from 'vitest'
import { createSdkGetter } from './sdk'

describe('createSdkGetter', () => {
  it('is lazy and returns one singleton', () => {
    const env = vi.fn(() => ({ backendUrl: 'http://localhost:9000', publishableKey: 'pk' }))
    const getSdk = createSdkGetter(env)
    expect(env).not.toHaveBeenCalled()
    expect(getSdk()).toBe(getSdk())
    expect(env).toHaveBeenCalledTimes(1)
  })

  it('propagates env errors and retries on the next call', () => {
    const env = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('no key')
      })
      .mockReturnValue({ backendUrl: 'http://localhost:9000', publishableKey: 'pk' })
    const getSdk = createSdkGetter(env)
    expect(() => getSdk()).toThrow('no key')
    expect(getSdk()).toBeDefined()
  })
})
