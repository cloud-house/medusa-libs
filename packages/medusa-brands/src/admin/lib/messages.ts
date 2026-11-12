import { useQuery } from '@tanstack/react-query'
import { fill } from '../../lib/fill'
import { type BrandLocale, type BrandMessages, messages as dictionaries } from '../../messages'
import { sdk } from './sdk'

export { fill }

/** react-query keys of the plugin. */
export const brandKey = (...parts: string[]) => ['brands', ...parts]

export type Brand = { id: string; name: string; handle: string }
export type BrandWithCount = Brand & { product_count: number }

/**
 * The page texts as the plugin options set them (`locale` + `messages`); `undefined` while
 * loading. When the request fails the bundled `pl` dictionary is used, so the page still renders.
 */
export function useBrandMessages(): BrandMessages | undefined {
  const { data, isError } = useQuery({
    queryKey: brandKey('messages'),
    queryFn: () =>
      sdk.client.fetch<{ locale: BrandLocale; messages: BrandMessages }>('/admin/brands/messages'),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return isError ? dictionaries.pl : data?.messages
}

/** Panel message for a failed request – Medusa keeps the plugin's messages for 4xx. */
export const failure = (error: unknown, messages: BrandMessages) =>
  error instanceof Error ? error.message : messages.genericError
