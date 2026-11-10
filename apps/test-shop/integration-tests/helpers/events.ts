import type { MedusaContainer, Subscriber } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'

/**
 * Resolves with the data of the next event with this name. Unlike
 * `TestEventUtils.waitSubscribersExecution`, it works the same whether or not the app already has
 * subscribers for the event.
 */
export function nextEvent(
  container: MedusaContainer,
  name: string,
  timeoutMs = 15_000,
): Promise<Record<string, unknown>> {
  const eventBus = container.resolve(Modules.EVENT_BUS)
  const subscriberId = `test-${name}-${Math.random().toString(36).slice(2)}`
  return new Promise((resolve, reject) => {
    const handler: Subscriber<Record<string, unknown>> = async (event) => {
      clearTimeout(timer)
      eventBus.unsubscribe(name, handler, { subscriberId })
      resolve(event.data)
    }
    const timer = setTimeout(() => {
      eventBus.unsubscribe(name, handler, { subscriberId })
      reject(new Error(`Timeout of ${timeoutMs}ms waiting for event "${name}"`))
    }, timeoutMs)
    eventBus.subscribe(name, handler, { subscriberId })
  })
}
