import { asValue } from '@medusajs/framework/awilix'
import { createMedusaContainer } from '@medusajs/framework/utils'
import { resolveOptions } from '../../options'

export const testOptions = (over: Partial<Parameters<typeof resolveOptions>[0]> = {}) =>
  resolveOptions({
    paths: {
      confirmEmail: '/account/confirm-email',
      passwordReset: '/nowe-haslo',
      setPassword: '/account/set-password',
    },
    storefrontUrl: 'https://shop.example',
    resolveContact: async () => ({
      email: 'help@shop.example',
      phone: null,
      hours: null,
      seller: null,
    }),
    ...over,
  })

/** A container with only the services the subscribers read; `services` are plain fakes. */
export function fakeContainer(services: Record<string, unknown>, over = {}) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const container = createMedusaContainer()
  const all: Record<string, unknown> = {
    logger,
    accounts: { getOptions: () => testOptions(over) },
    ...services,
  }
  for (const [key, value] of Object.entries(all)) container.register(key, asValue(value))
  return { container, logger }
}

/** A reset token with the given `jti` (only the payload is read). */
export const tokenWith = (jti?: string) =>
  `h.${Buffer.from(JSON.stringify(jti ? { jti } : {})).toString('base64url')}.s`
