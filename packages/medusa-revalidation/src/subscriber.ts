import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  type RevalidationLocale,
  type RevalidationMessages,
  resolveRevalidationMessages,
} from './messages'
import { type PostRevalidateOptions, postRevalidate, type TagLookup } from './revalidation'

export interface RevalidationSubscriberOptions {
  /** Events the subscriber listens to. */
  events: string[]
  /** Tags to purge for an event. */
  tagsForEvent(name: string, data: Record<string, unknown>, lookup: TagLookup): Promise<string[]>
  /** Env variable with the storefront URL. Default `STOREFRONT_URL`. */
  urlEnv?: string
  /** Env variable with the webhook secret. Default `REVALIDATE_SECRET`. */
  secretEnv?: string
  header?: PostRevalidateOptions['header']
  isAllowedTag?: PostRevalidateOptions['isAllowedTag']
  /** Prefix of log lines. Default `Revalidation`. */
  logPrefix?: string
  /** Language of the log lines. Default `'en'`. */
  locale?: RevalidationLocale
  /** Single log texts over the `locale` dictionary. */
  messages?: Partial<RevalidationMessages>
}

/**
 * Builds the `handler` and `config` of a Medusa subscriber that purges storefront cache tags.
 * Without URL or secret it does nothing (and warns once).
 */
export function createRevalidationSubscriber(options: RevalidationSubscriberOptions): {
  handler(args: SubscriberArgs<Record<string, unknown>>): Promise<void>
  config: SubscriberConfig
} {
  const urlEnv = options.urlEnv ?? 'STOREFRONT_URL'
  const secretEnv = options.secretEnv ?? 'REVALIDATE_SECRET'
  const logPrefix = options.logPrefix ?? 'Revalidation'
  const texts = resolveRevalidationMessages(options.locale, options.messages)
  let warned = false

  async function handler({ event, container }: SubscriberArgs<Record<string, unknown>>) {
    const url = process.env[urlEnv]
    const secret = process.env[secretEnv]
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    if (!url || !secret) {
      if (!warned) {
        warned = true
        logger.warn(`${logPrefix}: ${texts.notConfigured(urlEnv, secretEnv)}`)
      }
      return
    }

    const product = container.resolve(Modules.PRODUCT)
    try {
      const tags = await options.tagsForEvent(event.name, event.data ?? {}, {
        productHandle: async (id) =>
          (await product.listProducts({ id }, { withDeleted: true, select: ['handle'] }))[0]
            ?.handle ?? null,
        categoryHandle: async (id) =>
          (
            await product.listProductCategories({ id }, { withDeleted: true, select: ['handle'] })
          )[0]?.handle ?? null,
      })
      await postRevalidate(tags, {
        url,
        secret,
        header: options.header,
        isAllowedTag: options.isAllowedTag,
        logger,
        logPrefix,
        locale: options.locale,
        messages: options.messages,
      })
    } catch (error) {
      logger.warn(`${logPrefix}: ${texts.tagsFailed(event.name, error)}`)
    }
  }

  return { handler, config: { event: options.events } }
}
