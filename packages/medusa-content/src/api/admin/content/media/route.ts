import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { CONTENT_MODULE } from '../../../../modules/content'
import type ContentModuleService from '../../../../modules/content/service'
import { uploadMediaWorkflow } from '../../../../workflows/media'

/** Media library: `?kind=image|document&q=…&limit=&offset=`, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const kind =
    req.query.kind === 'document' ? 'document' : req.query.kind === 'image' ? 'image' : undefined
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(Number(req.query.limit) || 60, 200)
  const offset = Number(req.query.offset) || 0
  const filters = {
    ...(kind ? { kind } : {}),
    ...(q ? { $or: [{ alt: { $ilike: `%${q}%` } }, { filename: { $ilike: `%${q}%` } }] } : {}),
  }
  const [media, count] = await content.listAndCountMediaAssets(filters, {
    order: { created_at: 'DESC' },
    take: limit,
    skip: offset,
  })
  res.json({ media, count, limit, offset })
}

/** Multipart upload (`files`, plus optional `alt`, `credit`, `credit_url` fields). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const files = (req as unknown as { files?: Express.Multer.File[] }).files ?? []
  if (!files.length)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Wybierz plik do wysłania.')
  const body = (req.body ?? {}) as Record<string, string | undefined>
  const media: unknown[] = []
  for (const file of files) {
    const { result } = await uploadMediaWorkflow(req.scope).run({
      input: {
        filename: file.originalname,
        mime_type: file.mimetype,
        content: file.buffer.toString('base64'),
        alt: body.alt ?? null,
        credit: body.credit ?? null,
        credit_url: body.credit_url ?? null,
      },
    })
    media.push(result)
  }
  res.status(201).json({ media })
}
