import { z } from '@medusajs/framework/zod'

export const AdminSetProductBrand = z.object({ brand_id: z.string().min(1).nullable() })
export type AdminSetProductBrandType = z.infer<typeof AdminSetProductBrand>
