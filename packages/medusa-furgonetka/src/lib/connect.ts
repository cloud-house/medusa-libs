import type { MedusaContainer } from '@medusajs/framework/types'
import { createFurgonetkaClient, type FurgonetkaClient } from './client'
import type { FurgonetkaConfig } from './config'
import { createFakeClient } from './fake'
import { accessToken } from './tokens'

/**
 * The API client for the connected account, or the in-process fake for `FURGONETKA_URL=atrapa`.
 * Every call asks for the access token anew, so a token that is about to end is replaced first.
 * `fetch` serves the tests: the token refresh goes through it as well.
 */
export function clientFor(
  container: MedusaContainer,
  config: FurgonetkaConfig,
  fetch?: typeof globalThis.fetch,
): FurgonetkaClient {
  if (config.client === 'fake') return createFakeClient()
  if (!config.url) throw new Error('Furgonetka: brak adresu API.')
  return createFurgonetkaClient({
    url: config.url,
    accessToken: () => accessToken(container, config, undefined, fetch),
    fetch,
  })
}
