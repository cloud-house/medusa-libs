import type { MedusaContainer } from '@medusajs/framework/types'
import { CONTENT_ERROR_CODES, contentError } from './errors'
import { type ContentKind, KindRegistry } from './kinds'
import type { EntityKind } from './types'

/** `plugins: [{ resolve: '@cloud-house/medusa-content', options }]` in `medusa-config.ts`. */
export type ContentOptions = {
  /** The kinds of content of the shop (`contentKinds()` for the ready-made ones plus its own). Required. */
  kinds: ContentKind[]
  /** Secret that signs preview tokens; default `process.env.CONTENT_PREVIEW_SECRET`. */
  previewSecret?: string
  /** Request header with the preview token; default `x-preview-token`. */
  previewHeader?: string
  /** Folder of the uploaded media in the file provider; default `content`. */
  mediaFolder?: string
  /** Path of the storefront route that starts a preview (`STOREFRONT_URL` + path); default `/api/preview`. */
  previewPath?: string
  /** Prefix of the log lines; default `[Content]`. */
  logPrefix?: string
  /** Current handle of a product, category or brand (for the address history); default reads the Product module and `brand`. */
  resolveEntityHandle?: (
    container: MedusaContainer,
    kind: EntityKind,
    entityId: string,
  ) => Promise<string | null>
}

export interface ResolvedContentOptions {
  registry: KindRegistry
  previewSecret: string | null
  previewHeader: string
  mediaFolder: string
  previewPath: string
  logPrefix: string
  resolveEntityHandle: NonNullable<ContentOptions['resolveEntityHandle']> | null
}

const HEADER_NAME = /^[a-z0-9-]{1,64}$/

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** Options with the defaults filled in (`undefined` values count as unset); throws when one is wrong. */
export function resolveOptions(options: ContentOptions): ResolvedContentOptions {
  const given = withoutUndefined(options)
  if (given.kinds === undefined) {
    throw contentError(
      CONTENT_ERROR_CODES.missingOption,
      'option "kinds" is required (e.g. contentKinds()).',
    )
  }
  const registry = new KindRegistry(given.kinds)
  const {
    previewHeader = 'x-preview-token',
    mediaFolder = 'content',
    previewPath = '/api/preview',
    logPrefix = '[Content]',
    resolveEntityHandle = null,
  } = given
  if (typeof previewHeader !== 'string' || !HEADER_NAME.test(previewHeader)) {
    throw contentError(
      CONTENT_ERROR_CODES.invalidOption,
      `option "previewHeader" must be a lower-case header name (got "${String(previewHeader)}").`,
    )
  }
  if (typeof mediaFolder !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(mediaFolder)) {
    throw contentError(
      CONTENT_ERROR_CODES.invalidOption,
      `option "mediaFolder" must match [A-Za-z0-9_-]{1,60} (got "${String(mediaFolder)}").`,
    )
  }
  if (typeof previewPath !== 'string' || !previewPath.startsWith('/')) {
    throw contentError(
      CONTENT_ERROR_CODES.invalidOption,
      `option "previewPath" must start with "/" (got "${String(previewPath)}").`,
    )
  }
  const secret = given.previewSecret ?? process.env.CONTENT_PREVIEW_SECRET
  return {
    registry,
    previewSecret: secret && secret.length > 0 ? secret : null,
    previewHeader,
    mediaFolder,
    previewPath,
    logPrefix,
    resolveEntityHandle,
  }
}
