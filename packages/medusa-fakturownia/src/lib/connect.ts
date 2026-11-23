import { createFakturowniaClient, type FakturowniaClient } from './client'
import type { FakturowniaConfig } from './config'
import { createFakeClient } from './fake'

/** The API client for the account, or the in-process fake for `FAKTUROWNIA_URL=atrapa`. */
export function clientFor(
  config: FakturowniaConfig,
  fetch?: typeof globalThis.fetch,
): FakturowniaClient {
  if (config.client === 'fake') return createFakeClient()
  if (!config.url || !config.token) throw new Error('Fakturownia: brak adresu albo tokenu API.')
  return createFakturowniaClient({ url: config.url, token: config.token, fetch })
}
