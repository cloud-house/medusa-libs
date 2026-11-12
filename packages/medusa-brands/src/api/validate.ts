import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import type { z } from '@medusajs/framework/zod'
import { BRAND_ERROR_CODES, type BrandErrorCode } from '../errors'
import { brandsOptions } from '../lib/plugin-options'
import type { BrandMessages } from '../messages'

/**
 * `validateAndTransformBody` that answers 400 with a stable `code` and the plugin's own text
 * (Medusa's would wrap a generic "Invalid request" message and give no code). `schemaFor` gets
 * the texts of the plugin options, which are only known per request; `codeOf` maps the failing
 * body field to a code.
 */
export function validateBody<S extends z.ZodType>(
  schemaFor: (messages: BrandMessages) => S,
  codeOf: (field: string | undefined) => BrandErrorCode,
) {
  const schemas = new WeakMap<BrandMessages, S>()
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const { messages } = brandsOptions(req.scope)
    let schema = schemas.get(messages)
    if (!schema) {
      schema = schemaFor(messages)
      schemas.set(messages, schema)
    }
    const parsed = schema.safeParse(req.body ?? {})
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      res.status(400).json({
        type: 'invalid_data',
        code: codeOf(issue?.path[0]?.toString()),
        message: issue?.message ?? messages.genericError,
      })
      return
    }
    req.validatedBody = parsed.data
    next()
  }
}

export const brandFieldCode = (field: string | undefined): BrandErrorCode =>
  field === 'handle' ? BRAND_ERROR_CODES.handleInvalid : BRAND_ERROR_CODES.nameInvalid
