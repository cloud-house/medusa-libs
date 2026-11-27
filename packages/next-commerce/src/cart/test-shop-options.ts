import type { LineSource } from './view'

/** The shop's grouping: an upgrade (`metadata.upgrade_of` = its board's variant) goes under the board. */
export function groupByUpgrade<T extends LineSource>(items: T[]) {
  const boards = new Map<string, { line: T; upgrades: T[] }>()
  for (const item of items) {
    if (!item.metadata?.upgrade_of && item.variant_id && !boards.has(item.variant_id)) {
      boards.set(item.variant_id, { line: item, upgrades: [] })
    }
  }
  const groups: { line: T; upgrades: T[] }[] = []
  for (const item of items) {
    const parent = item.metadata?.upgrade_of
    const board = typeof parent === 'string' ? boards.get(parent) : undefined
    if (board) {
      board.upgrades.push(item)
      continue
    }
    const own = item.variant_id ? boards.get(item.variant_id) : undefined
    groups.push(own && own.line.id === item.id ? own : { line: item, upgrades: [] })
  }
  return groups
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The shop's product link with the chosen colour and size. */
export const productLink = (
  handle: string,
  { color, size }: { color: string | null; size: string | null },
) => {
  const query = new URLSearchParams()
  if (color) query.set('kolor', slug(color))
  if (size) query.set('rozmiar', slug(size))
  const search = query.toString()
  return `/produkt/${handle}${search ? `?${search}` : ''}`
}

/** The view options of a shop like ChoNaSupa, for the tests. */
export const SHOP_VIEW_OPTIONS = {
  groupLines: groupByUpgrade,
  href: productLink,
  hiddenSize: 'Standard',
}
