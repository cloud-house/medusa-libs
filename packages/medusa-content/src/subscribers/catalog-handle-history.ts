import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { defaultEntityHandle } from '../lib/entities'
import { recordHandle } from '../lib/handle-history'
import { contentOptions } from '../lib/plugin-options'
import type { EntityKind } from '../types'
import { ContentEvents } from '../workflows/events'

const EVENTS: Record<string, EntityKind> = {
  'product.created': 'product',
  'product.updated': 'product',
  'product.deleted': 'product',
  'product-category.created': 'category',
  'product-category.updated': 'category',
  'product-category.deleted': 'category',
  // Events of `@cloud-house/medusa-brands`; without that plugin they never fire.
  'brand.created': 'brand',
  'brand.updated': 'brand',
  'brand.deleted': 'brand',
}

/**
 * Old addresses of renamed products, categories and brands (the shop answers them with 308), and
 * the content of deleted ones. Only for the kinds a shop bound to a record (`entity`). A rename
 * purges every content read – others embed the handle.
 */
export default async function catalogHandleHistory({
  event,
  container,
}: SubscriberArgs<{ id?: string; handle?: string }>) {
  const kind = EVENTS[event.name]
  const id = event.data?.id
  if (!kind || !id) return
  const options = contentOptions(container)
  if (!options.registry.entityKinds().some((registered) => registered.entity === kind)) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    let handle: string | null = null
    if (!event.name.endsWith('.deleted')) {
      if (options.resolveEntityHandle) {
        handle = await options.resolveEntityHandle(container, kind, id)
      } else if (kind === 'brand') {
        handle = event.data?.handle ?? (await defaultEntityHandle(container, kind, id))
      } else {
        const product = container.resolve(Modules.PRODUCT)
        const rows =
          kind === 'product'
            ? await product.listProducts({ id }, { select: ['handle'] })
            : await product.listProductCategories({ id }, { select: ['handle'] })
        handle = rows[0]?.handle ?? null
      }
      if (handle === null) return
    }
    const { renamed_from } = await recordHandle(container, kind, id, handle)
    if (renamed_from) {
      await container.resolve(Modules.EVENT_BUS).emit({
        name: ContentEvents.HANDLE_CHANGED,
        data: { kind, id, old_handle: renamed_from, handle },
      })
    }
  } catch (error) {
    logger.warn(`${options.logPrefix} historia adresów nie zapisała ${event.name} ${id}: ${error}`)
  }
}

export const config: SubscriberConfig = { event: Object.keys(EVENTS) }
