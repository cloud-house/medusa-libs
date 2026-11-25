import { slugify } from '../slugify'

export interface TocItem {
  id: string
  text: string
}

/** Spis treści pokazujemy dopiero przy tylu sekcjach H2 (spec 4a §3). */
export const MIN_TOC_ITEMS = 4

type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  children?: unknown[]
  fields?: unknown
}

const textOf = (node: LexicalNode): string =>
  typeof node.text === 'string'
    ? node.text
    : (node.children ?? []).map((child) => textOf(child as LexicalNode)).join('')

/**
 * Kopia treści, w której każdy nagłówek H2 ma `anchor` (id do linku `#…`), oraz spis tych nagłówków.
 * Kotwica to `slugify` tekstu, powtórki dostają `-2`, `-3`; nagłówek bez liter – „sekcja”.
 */
export function annotateHeadings(content: unknown): { content: unknown; toc: TocItem[] } {
  const root = (content as { root?: { children?: unknown[] } } | null)?.root
  if (!root || !Array.isArray(root.children)) return { content, toc: [] }

  const toc: TocItem[] = []
  const used = new Map<string, number>()
  const children = root.children.map((child) => {
    const node = child as LexicalNode
    if (node?.type !== 'heading' || node.tag !== 'h2') return child
    const text = textOf(node).trim()
    const base = slugify(text) || 'sekcja'
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    const id = count === 1 ? base : `${base}-${count}`
    toc.push({ id, text })
    return { ...node, anchor: id }
  })
  return { content: { ...(content as object), root: { ...root, children } }, toc }
}

export function visibleToc(toc: TocItem[]): TocItem[] {
  return toc.length >= MIN_TOC_ITEMS ? toc : []
}

/** Czy treść zawiera blok (albo blok w linii) danego typu – np. cennik, który wymaga Medusy. */
export function usesBlock(content: unknown, blockType: string): boolean {
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const { fields, children, root } = node as LexicalNode & { root?: unknown }
    if ((fields as { blockType?: unknown } | undefined)?.blockType === blockType) return true
    if (root) return visit(root)
    return Array.isArray(children) && children.some(visit)
  }
  return visit(content)
}
