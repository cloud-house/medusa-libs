import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import {
  deleteFilesWorkflow,
  emitEventStep,
  uploadFilesWorkflow,
} from '@medusajs/medusa/core-flows'
import sharp from 'sharp'
import { notAllowed } from '../lib/api-errors'
import { contentOptions } from '../lib/plugin-options'
import { CONTENT_MODULE } from '../modules/content'
import type ContentModuleService from '../modules/content/service'
import { ContentEvents } from './events'

export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]
export const DOCUMENT_TYPES = ['application/pdf']
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export interface UploadMediaInput {
  filename: string
  mime_type: string
  /** File content, base64. */
  content: string
  alt?: string | null
  credit?: string | null
  credit_url?: string | null
}

const describeMediaStep = createStep('describe-media', async (input: UploadMediaInput) => {
  const kind = IMAGE_TYPES.includes(input.mime_type)
    ? 'image'
    : DOCUMENT_TYPES.includes(input.mime_type)
      ? 'document'
      : null
  if (!kind) throw notAllowed('Dozwolone są zdjęcia (JPG, PNG, WebP, AVIF, GIF, SVG) i pliki PDF.')
  const buffer = Buffer.from(input.content, 'base64')
  if (buffer.length > MAX_UPLOAD_BYTES) throw notAllowed('Plik może mieć najwyżej 20 MB.')
  let width: number | null = null
  let height: number | null = null
  if (kind === 'image') {
    const meta = await sharp(buffer).metadata()
    width = meta.width ?? null
    height = meta.height ?? null
  }
  return new StepResponse({ kind, filesize: buffer.length, width, height } as const)
})

const createMediaStep = createStep(
  'create-media-asset',
  async (
    input: UploadMediaInput & {
      file: { id: string; url: string }
      kind: 'image' | 'document'
      filesize: number
      width: number | null
      height: number | null
    },
    { container },
  ) => {
    const content: ContentModuleService = container.resolve(CONTENT_MODULE)
    const asset = await content.createMediaAssets({
      kind: input.kind,
      file_id: input.file.id,
      url: input.file.url,
      filename: input.filename,
      mime_type: input.mime_type,
      filesize: input.filesize,
      width: input.width,
      height: input.height,
      alt: input.alt?.trim() ?? '',
      credit: input.credit?.trim() || null,
      credit_url: input.credit_url?.trim() || null,
    })
    return new StepResponse(asset, asset.id)
  },
  async (id, { container }) => {
    if (id) await (container.resolve(CONTENT_MODULE) as ContentModuleService).deleteMediaAssets(id)
  },
)

/** Base name only, plain characters: the upload cannot leave its folder. */
export const safeName = (name: string) =>
  (name.split(/[\\/]/).pop() ?? '').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '') || 'file'

const resolveFolderStep = createStep(
  'resolve-media-folder',
  async (_: undefined, { container }) => new StepResponse(contentOptions(container).mediaFolder),
)

/** Uploads an image or PDF through the file provider (folder `mediaFolder`) and describes it in the media library. */
export const uploadMediaWorkflow = createWorkflow('upload-media', (input: UploadMediaInput) => {
  const described = describeMediaStep(input)
  const folder = resolveFolderStep()
  const upload = transform({ input, folder }, ({ input, folder }) => ({
    files: [
      {
        filename: `${folder}/${safeName(input.filename)}`,
        mimeType: input.mime_type,
        content: input.content,
        access: 'public' as const,
      },
    ],
  }))
  const files = uploadFilesWorkflow.runAsStep({ input: upload })
  const assetInput = transform({ input, described, files }, ({ input, described, files }) => ({
    ...input,
    file: { id: files[0]?.id ?? '', url: files[0]?.url ?? '' },
    kind: described.kind,
    filesize: described.filesize,
    width: described.width,
    height: described.height,
  }))
  const asset = createMediaStep(assetInput)
  return new WorkflowResponse(asset)
})

const deleteMediaStep = createStep('delete-media-asset', async (id: string, { container }) => {
  const content: ContentModuleService = container.resolve(CONTENT_MODULE)
  const asset = await content.retrieveMediaAsset(id)
  const users = await content.entriesUsing({ target_type: 'media', target_id: id })
  if (users.length) {
    const names = users.map((user) => user.title ?? user.slug ?? user.type).slice(0, 3)
    throw notAllowed(`Plik jest używany (${names.join(', ')}) – najpierw go tam podmień.`)
  }
  await content.deleteMediaAssets(id)
  return new StepResponse(asset)
})

export const deleteMediaWorkflow = createWorkflow('delete-media', (id: string) => {
  const asset = deleteMediaStep(id)
  const files = transform({ asset }, ({ asset }) => ({ ids: [asset.file_id] }))
  deleteFilesWorkflow.runAsStep({ input: files })
  const event = transform({ asset }, ({ asset }) => ({
    id: asset.id,
    type: 'media',
    slug: null,
    published: true,
  }))
  emitEventStep({ eventName: ContentEvents.CHANGED, data: event })
  return new WorkflowResponse(asset)
})
