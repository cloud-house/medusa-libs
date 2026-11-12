import { HANDLE_PATTERN } from '@cloud-house/commerce-rules'
import { z } from '@medusajs/framework/zod'
import type { BrandMessages } from '../../../messages'

const fields = (messages: BrandMessages) => ({
  name: z.string().trim().min(1, messages.nameRequired).max(80, messages.nameTooLong),
  handle: z.string().regex(HANDLE_PATTERN, messages.handleInvalid),
})

/** Body schemas of the create and update routes, with the texts of the plugin options. */
export const adminCreateBrandFor = (messages: BrandMessages) => {
  const { name, handle } = fields(messages)
  return z.object({ name, handle: handle.optional() })
}
export type AdminCreateBrandType = z.infer<ReturnType<typeof adminCreateBrandFor>>

export const adminUpdateBrandFor = (messages: BrandMessages) => {
  const { name, handle } = fields(messages)
  return z.object({ name: name.optional(), handle: handle.optional() })
}
export type AdminUpdateBrandType = z.infer<ReturnType<typeof adminUpdateBrandFor>>
