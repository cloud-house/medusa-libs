import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { contentOptions } from '../../lib/plugin-options'
import { collectRefs } from '../../lib/refs'
import { CONTENT_MODULE } from '../../modules/content'
import type ContentModuleService from '../../modules/content/service'
import type { EntryRow } from '../../types'

/** What the published state and the working copy point at (delete guards, product articles). */
export const rebuildRefsStep = createStep(
  'rebuild-content-refs',
  async (entry: EntryRow, { container }) => {
    const content: ContentModuleService = container.resolve(CONTENT_MODULE)
    const { registry } = contentOptions(container)
    const published = entry.status === 'published' ? entry.data : null
    await content.replaceRefs(
      entry.id,
      'published',
      collectRefs(registry, entry.type, entry.slug, published),
    )
    await content.replaceRefs(
      entry.id,
      'draft',
      collectRefs(registry, entry.type, entry.slug, entry.draft),
    )
    return new StepResponse(undefined)
  },
)
