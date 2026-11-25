import { validateHttpUrl } from '@cloud-house/commerce-rules'
import { z } from '@medusajs/framework/zod'

/** Optional text from the panel: empty or whitespace is stored as `null`. */
export const optionalText = z
  .string()
  .nullish()
  .transform((value) => (value?.trim() ? value.trim() : null))

export const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message)

/** Id of a media asset (`med_…`); unpopulated in storage, the store response carries the file. */
export const mediaRef = z
  .string()
  .min(1)
  .nullish()
  .transform((value) => value ?? null)

/** Id of a Medusa product (`prod_…`). */
export const productRef = z.string().min(1)

/** Rows of an array field with the panel's row limit. */
export const rows = <T extends z.ZodTypeAny>(row: T, max: number, label: string) =>
  z
    .array(row)
    .max(max, `${label}: najwyżej ${max}.`)
    .nullish()
    .transform((value) => value ?? [])

/** Lexical editor state (`{ root: … }`); content rules are checked by walking its nodes. */
export const lexical = z
  .object({
    root: z.object({ type: z.literal('root'), children: z.array(z.unknown()) }).passthrough(),
  })
  .passthrough()
  .nullish()
  .transform((value) => value ?? null)

/** Wraps a `true | string` field validator from commerce-rules into a zod check. */
export const checked = <T extends z.ZodTypeAny>(
  schema: T,
  validate: (value: z.output<T>) => true | string,
) =>
  schema.superRefine((value, ctx) => {
    const result = validate(value)
    if (result !== true) ctx.addIssue({ code: 'custom', message: result })
  })

export const httpUrl = checked(optionalText, (value) => validateHttpUrl(value))
