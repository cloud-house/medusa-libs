import type { MedusaContainer } from '@medusajs/framework/types'
import { MedusaError } from '@medusajs/framework/utils'
import { ACCOUNT_ERROR_CODES } from '../errors'
import type { AccountsMessages } from '../messages'
import { accountsOptions } from './plugin-options'

/** A `MedusaError` with the dictionary text of `key` (the shop's `locale`/`messages`) and its stable code. */
export const accountError = (
  container: Pick<MedusaContainer, 'resolve'>,
  type: (typeof MedusaError.Types)[keyof typeof MedusaError.Types],
  key: keyof AccountsMessages,
) => new MedusaError(type, accountsOptions(container).messages[key], ACCOUNT_ERROR_CODES[key])
