import { z } from '@medusajs/framework/zod'

/** Body of every content save; `data` is checked per kind in the workflow. */
export const AdminSaveContent = z.object({
  mode: z.enum(['autosave', 'draft', 'publish']),
  data: z.record(z.string(), z.unknown()),
  expected_updated_at: z.string().nullish(),
})
export type AdminSaveContentType = z.infer<typeof AdminSaveContent>

export const AdminCreateContent = AdminSaveContent.extend({
  /** Key of a registered kind without a fixed address or record (checked in the workflow). */
  type: z.string().min(1),
})
export type AdminCreateContentType = z.infer<typeof AdminCreateContent>

export const AdminUnpublishContent = z.object({ expected_updated_at: z.string().nullish() })
export type AdminUnpublishContentType = z.infer<typeof AdminUnpublishContent>

export const AdminUpdateMedia = z.object({
  alt: z.string().max(300).optional(),
  credit: z.string().max(120).nullish(),
  credit_url: z.string().max(500).nullish(),
})
export type AdminUpdateMediaType = z.infer<typeof AdminUpdateMedia>

export const AdminContentPreview = z.object({
  target: z.enum(['page', 'article', 'home']),
  id: z.string().nullish(),
})
export type AdminContentPreviewType = z.infer<typeof AdminContentPreview>
