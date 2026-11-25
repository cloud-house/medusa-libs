import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { emitEventStep } from '@medusajs/medusa/core-flows'
import { type ContentEventData, ContentEvents } from './events'
import { rebuildRefsStep } from './steps/rebuild-refs'
import { type WriteContentInput, writeContentStep } from './steps/write-content'

/** Saves a working copy or publishes content; the store's cache is purged on publication. */
export const saveContentWorkflow = createWorkflow('save-content', (input: WriteContentInput) => {
  const result = writeContentStep(input)
  const entry = transform({ result }, ({ result }) => result.entry)
  rebuildRefsStep(entry)
  const eventData = transform(
    { result },
    ({ result }): ContentEventData => ({
      id: result.entry.id,
      type: result.entry.type,
      slug: result.entry.slug,
      previous_slug: result.previous_slug,
      handle: result.handle,
      published: result.published,
    }),
  )
  emitEventStep({ eventName: ContentEvents.CHANGED, data: eventData })
  return new WorkflowResponse(entry)
})
