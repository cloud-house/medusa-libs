import type { KindRegistry, VersionPolicy } from '../../kinds'

export type { VersionPolicy }

/** Version policy of the kind of an entry (`global` entries by their `slug`); unknown kinds have none. */
export const versionPolicy = (
  registry: KindRegistry,
  type: string,
  slug: string | null,
): VersionPolicy => registry.policyFor(type, slug)

export const CONFLICT_MESSAGE = 'Ktoś zmienił tę treść w międzyczasie – odśwież stronę.'
