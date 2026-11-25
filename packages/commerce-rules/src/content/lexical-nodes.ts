import { READING_WORDS_PER_MINUTE } from './article-rules'

/** Blok „Produkty” w treści artykułu (spec 4b §4.3) – nazwa jak w `ARTICLE_BLOCKS`. */
const PRODUCT_CARDS = 'productCards'

export type LexicalNode = {
  type?: string
  text?: string
  children?: unknown[]
  fields?: Record<string, unknown>
  root?: unknown
}

/** Wszystkie węzły drzewa Lexical w kolejności dokumentu (bez wnętrza bloków – nie mają `children`). */
function* walk(content: unknown): Generator<LexicalNode> {
  if (!content || typeof content !== 'object') return
  const node = content as LexicalNode
  if (node.root) {
    yield* walk(node.root)
    return
  }
  yield node
  if (Array.isArray(node.children)) for (const child of node.children) yield* walk(child)
}

/** Węzły drzewa Lexical – do reguł treści w backendzie (linki, bloki, pliki). */
export const lexicalNodes = (content: unknown): Iterable<LexicalNode> => walk(content)

export function blockNodes(
  content: unknown,
  blockType: string,
): { fields: Record<string, unknown> }[] {
  const found: { fields: Record<string, unknown> }[] = []
  for (const node of walk(content)) {
    if (node.type === 'block' && node.fields?.blockType === blockType) {
      found.push({ fields: node.fields })
    }
  }
  return found
}

/** Czy treść linkuje do dokumentu danej kolekcji (np. kategorii sklepu, która wymaga mapy adresów). */
export function usesInternalLink(content: unknown, relationTo: string): boolean {
  for (const node of walk(content)) {
    const fields = node.fields as { linkType?: unknown; doc?: { relationTo?: unknown } } | undefined
    if (
      node.type === 'link' &&
      fields?.linkType === 'internal' &&
      fields.doc?.relationTo === relationTo
    ) {
      return true
    }
  }
  return false
}

// Słowo ma co najmniej jedną literę albo cyfrę – samotne myślniki (–, —, -) i wielokropki nie.
const WORD = /[\p{L}\p{N}]/u

/** Słowa w tekście treści – bloki (np. „Produkty”) i bloki w linii się nie liczą. */
export function countWords(content: unknown): number {
  let words = 0
  for (const node of walk(content)) {
    if (node.type === 'text' && typeof node.text === 'string') {
      words += node.text.split(/\s+/).filter((token) => WORD.test(token)).length
    }
  }
  return words
}

/** Czas czytania w minutach: 200 słów na minutę, w górę, co najmniej minuta (spec 4b §3). */
export function readingMinutes(content: unknown): number {
  return Math.max(1, Math.ceil(countWords(content) / READING_WORDS_PER_MINUTE))
}

const blockProducts = (content: unknown) =>
  blockNodes(content, PRODUCT_CARDS).flatMap(({ fields }) =>
    Array.isArray(fields.products) ? (fields.products as unknown[]) : [],
  )

/** Id produktów (`product-content`) ze wszystkich bloków „Produkty” – bez powtórek. */
export function blockProductIds(content: unknown): (number | string)[] {
  const ids = blockProducts(content).map((value) =>
    typeof value === 'object' && value ? (value as { id?: unknown }).id : value,
  )
  return [
    ...new Set(
      ids.filter((id): id is number | string => typeof id === 'number' || typeof id === 'string'),
    ),
  ]
}

/** Handle produktów z wypełnionych bloków „Produkty” (odczyt z `depth`) – bez powtórek. */
export function blockProductHandles(content: unknown): string[] {
  const handles = blockProducts(content).map((value) =>
    typeof value === 'object' && value ? (value as { handle?: unknown }).handle : null,
  )
  return [
    ...new Set(
      handles.filter((handle): handle is string => typeof handle === 'string' && handle !== ''),
    ),
  ]
}
