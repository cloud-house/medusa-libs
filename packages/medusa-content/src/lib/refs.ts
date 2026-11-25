import type { KindRegistry } from '../kinds'
import type { RefInput, RefKind } from '../types'

type PathKind = RefKind | 'lexical'

export type { RefKind }

/** Internal link targets in Lexical (`fields.doc.relationTo`) – names kept from the old panel. */
const LINK_KINDS: Record<string, RefKind> = {
  pages: 'entry',
  articles: 'entry',
  'product-content': 'product',
  'category-content': 'category',
  'brand-content': 'brand',
  media: 'media',
}

type Replace = (kind: RefKind, id: string) => unknown

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

function mapLexical(node: unknown, replace: Replace): unknown {
  if (Array.isArray(node)) return node.map((child) => mapLexical(child, replace))
  if (!isRecord(node)) return node
  const next: Record<string, unknown> = { ...node }
  if (node.type === 'upload' && typeof node.value === 'string') {
    next.value = replace('media', node.value)
  }
  if ((node.type === 'link' || node.type === 'autolink') && isRecord(node.fields)) {
    const doc = node.fields.doc
    if (isRecord(doc) && typeof doc.value === 'string' && typeof doc.relationTo === 'string') {
      const kind = LINK_KINDS[doc.relationTo]
      if (kind) next.fields = { ...node.fields, doc: { ...doc, value: replace(kind, doc.value) } }
    }
  }
  if (
    (node.type === 'block' || node.type === 'inlineBlock') &&
    isRecord(node.fields) &&
    Array.isArray(node.fields.products)
  ) {
    next.fields = {
      ...node.fields,
      products: node.fields.products.map((id) =>
        typeof id === 'string' ? replace('product', id) : id,
      ),
    }
  }
  if (node.root !== undefined) next.root = mapLexical(node.root, replace)
  if (Array.isArray(node.children)) next.children = mapLexical(node.children, replace)
  return next
}

function mapPath(value: unknown, path: string[], kind: PathKind, replace: Replace): unknown {
  if (path.length === 0) {
    if (kind === 'lexical') return mapLexical(value, replace)
    return typeof value === 'string' && value !== '' ? replace(kind, value) : value
  }
  const [head, ...rest] = path
  if (head === '*') {
    return Array.isArray(value) ? value.map((row) => mapPath(row, rest, kind, replace)) : value
  }
  if (!isRecord(value) || head === undefined || !(head in value)) return value
  return { ...value, [head]: mapPath(value[head], rest, kind, replace) }
}

/** Copy of `data` with every stored id replaced by `replace(kind, id)`. */
export function mapRefs(
  registry: KindRegistry,
  type: string,
  slug: string | null,
  data: unknown,
  replace: Replace,
): unknown {
  return registry
    .refPathsFor(type, slug)
    .reduce((current, [path, kind]) => mapPath(current, path.split('.'), kind, replace), data)
}

/** Everything `data` points at, without repeats. */
export function collectRefs(
  registry: KindRegistry,
  type: string,
  slug: string | null,
  data: unknown,
): RefInput[] {
  const found = new Map<string, RefInput>()
  mapRefs(registry, type, slug, data, (kind, id) => {
    found.set(`${kind}:${id}`, { target_type: kind, target_id: id })
    return id
  })
  return [...found.values()]
}
