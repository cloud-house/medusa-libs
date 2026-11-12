import type { MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { BRAND_ERROR_CODES } from '../errors'

type CodedError = { type?: string; code?: string; message?: string }

/**
 * Runs a brand workflow; a taken handle is answered 422 `brand_handle_taken` directly, because
 * Medusa's error handler replaces the `code` of a `DUPLICATE_ERROR` with `invalid_request_error`.
 * Returns `undefined` when it answered. The workflow engine rethrows a step's error as a plain
 * `Error` copy that keeps `type`, `code` and `message`, so it is recognised by those fields, not
 * by `instanceof MedusaError`.
 */
export async function orHandleTaken<T>(
  res: MedusaResponse,
  run: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await run()
  } catch (error) {
    const { type, code, message } = (error ?? {}) as CodedError
    if (type === MedusaError.Types.DUPLICATE_ERROR && code === BRAND_ERROR_CODES.handleTaken) {
      res.status(422).json({ type, code, message })
      return undefined
    }
    throw error
  }
}
