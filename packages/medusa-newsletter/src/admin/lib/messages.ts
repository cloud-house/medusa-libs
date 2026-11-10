import { useQuery } from '@tanstack/react-query'
import type { NewsletterLocale, NewsletterMessages } from '../../messages'
import { sdk } from './sdk'

/** react-query keys of the plugin. */
export const newsletterKey = (...parts: string[]) => ['newsletter', ...parts]

/** The page texts as the plugin options set them (`locale` + `messages`); `undefined` while loading. */
export function useNewsletterMessages(): NewsletterMessages | undefined {
  const { data } = useQuery({
    queryKey: newsletterKey('messages'),
    queryFn: () =>
      sdk.client.fetch<{ locale: NewsletterLocale; messages: NewsletterMessages }>(
        '/admin/newsletter/messages',
      ),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return data?.messages
}

/** `{name}` placeholders of a text filled in. */
export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )

/** Panel message for a failed request – Medusa keeps the plugin's messages for 4xx. */
export const failure = (error: unknown, messages: NewsletterMessages) =>
  error instanceof Error ? error.message : messages.genericError
