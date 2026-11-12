import { z } from '@medusajs/framework/zod'

const productId = z.string().trim().min(1).max(100)

export const StoreAccountFavorite = z.object({ product_id: productId }).strict()
export type StoreAccountFavoriteType = z.infer<typeof StoreAccountFavorite>

export const StoreAccountFavoritesMerge = z
  .object({
    items: z
      .array(z.object({ product_id: productId, added_at: z.string().datetime() }).strict())
      .max(500),
  })
  .strict()
export type StoreAccountFavoritesMergeType = z.infer<typeof StoreAccountFavoritesMerge>
