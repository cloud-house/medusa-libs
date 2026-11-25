import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { emitEventStep } from '@medusajs/medusa/core-flows'
import { type ContentEventData, ContentEvents } from './events'
import {
  deleteContentStep,
  restoreContentVersionStep,
  unpublishContentStep,
} from './steps/entry-actions'
import { rebuildRefsStep } from './steps/rebuild-refs'

export const unpublishContentWorkflow = createWorkflow(
  'unpublish-content',
  (input: { id: string; expected_updated_at?: string | null; user_id?: string | null }) => {
    const result = unpublishContentStep(input)
    const entry = transform({ result }, ({ result }) => result.entry)
    rebuildRefsStep(entry)
    const eventData = transform(
      { result },
      ({ result }): ContentEventData => ({
        id: result.entry.id,
        type: result.entry.type,
        slug: result.entry.slug,
        handle: result.handle,
        published: true,
      }),
    )
    emitEventStep({ eventName: ContentEvents.CHANGED, data: eventData })
    return new WorkflowResponse(entry)
  },
)

/** A version back into the working copy (store settings: published at once). */
export const restoreContentVersionWorkflow = createWorkflow(
  'restore-content-version',
  (input: { version_id: string; user_id?: string | null }) => {
    const result = restoreContentVersionStep(input)
    const entry = transform({ result }, ({ result }) => result.entry)
    rebuildRefsStep(entry)
    const eventData = transform(
      { result },
      ({ result }): ContentEventData => ({
        id: result.entry.id,
        type: result.entry.type,
        slug: result.entry.slug,
        handle: result.handle,
        published: result.published,
      }),
    )
    emitEventStep({ eventName: ContentEvents.CHANGED, data: eventData })
    return new WorkflowResponse(entry)
  },
)

export const deleteContentWorkflow = createWorkflow(
  'delete-content',
  (input: { id: string; allow_protected_change?: boolean }) => {
    const result = deleteContentStep(input)
    const eventData = transform(
      { result },
      ({ result }): ContentEventData => ({
        id: result.entry.id,
        type: result.entry.type,
        slug: result.entry.slug,
        handle: result.handle,
        published: result.entry.status === 'published',
      }),
    )
    emitEventStep({ eventName: ContentEvents.DELETED, data: eventData })
    return new WorkflowResponse(result.entry)
  },
)
