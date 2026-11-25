import type { ReactNode } from 'react'
import type { Data, Related } from '../components/content/api'

/**
 * What a shop adds to the panel at run time. Kept on `globalThis`: the plugin's extension and the
 * shop's code (which imports `@cloud-house/medusa-content/admin-kit`) are separate bundles, but
 * one browser page, so both see the same registry.
 */
export interface HomeBlockUi {
  /** The `blockType` of the rows – must match a `HomeBlockDefinition.type` of the server kind. */
  type: string
  label: string
  /** The block can be added once. */
  single?: boolean
  /** Content of a new block. */
  empty: () => Data
  /** The fields of one block. */
  render: (props: {
    block: Data & { id: string; blockType: string }
    set: (patch: Data) => void
    related: Related
    remember: (kind: keyof Related, id: string, doc: never) => void
  }) => ReactNode
}

export interface HubSection {
  to: string
  title: string
  text: string
}

interface Registry {
  homeBlocks: Map<string, HomeBlockUi>
  hubSections: Map<string, HubSection>
}

const KEY = '__cloudHouseContentUi'

function registry(): Registry {
  const shared = globalThis as unknown as Record<string, Registry | undefined>
  shared[KEY] ??= { homeBlocks: new Map(), hubSections: new Map() }
  return shared[KEY] as Registry
}

/** Adds a home-page block of the shop to the „Dodaj blok” menu and to the block list. */
export const registerHomeBlock = (block: HomeBlockUi) => {
  registry().homeBlocks.set(block.type, block)
}
export const homeBlockUis = (): HomeBlockUi[] => [...registry().homeBlocks.values()]
export const homeBlockUi = (type: string): HomeBlockUi | undefined =>
  registry().homeBlocks.get(type)

/** Adds a tile to the „Treści” hub page (a page of the shop, a settings page…). */
export const registerHubSection = (section: HubSection) => {
  registry().hubSections.set(section.to, section)
}
export const hubSections = (): HubSection[] => [...registry().hubSections.values()]
