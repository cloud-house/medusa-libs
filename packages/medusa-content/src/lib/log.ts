import type { Logger, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { logPrefix } from './plugin-options'

/** The container's logger with the shop's `logPrefix` in front of every message. */
export function prefixedLogger(container: MedusaContainer): Logger {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as Logger
  const prefix = logPrefix(container)
  const wrap = (write: (message: string) => void) => (message: string) =>
    write.call(logger, `${prefix} ${message}`)
  return Object.assign(Object.create(logger), {
    warn: wrap(logger.warn),
    error: wrap(logger.error),
    info: wrap(logger.info),
    debug: wrap(logger.debug),
  }) as Logger
}
