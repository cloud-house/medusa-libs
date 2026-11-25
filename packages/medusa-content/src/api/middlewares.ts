import { defineMiddlewares, validateAndTransformBody } from '@medusajs/framework/http'
import multer from 'multer'
import {
  AdminContentPreview,
  AdminCreateContent,
  AdminSaveContent,
  AdminUnpublishContent,
  AdminUpdateMedia,
} from './admin/content/validators'

/** Uploads to the media library, kept in memory on their way to the file provider (20 MB, like the workflow's limit). */
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/content/entries',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateContent)],
    },
    {
      matcher: '/admin/content/entries/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminSaveContent)],
    },
    {
      matcher: '/admin/content/entries/:id/unpublish',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUnpublishContent)],
    },
    {
      matcher: '/admin/content/globals/:key',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminSaveContent)],
    },
    {
      matcher: '/admin/content/catalog/:type/:entity_id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminSaveContent)],
    },
    {
      matcher: '/admin/content/preview',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminContentPreview)],
    },
    {
      matcher: '/admin/content/media',
      method: 'POST',
      middlewares: [mediaUpload.array('files')],
    },
    {
      matcher: '/admin/content/media/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUpdateMedia)],
    },
  ],
})
