import { isSafeLinkUrl, lexicalNodes } from '@cloud-house/commerce-rules'

export interface LexicalRules {
  /** Collections an internal link may point at (`fields.doc.relationTo`). */
  collections: readonly string[]
  /** Images inside the text (`upload` nodes). */
  uploads: boolean
  /** Allowed `block` / `inlineBlock` types; empty – none. */
  blocks?: readonly string[]
  /** Message for a link to a collection outside `collections`. */
  linkMessage?: string
  /** Extra check of one block's fields; a message – broken. */
  blockError?: (blockType: string, fields: Record<string, unknown>) => string | null
}

/** First broken rule of the editor content, as a message for the panel; `true` – fine. */
export function lexicalLinkError(content: unknown, rules: LexicalRules): true | string {
  for (const node of lexicalNodes(content)) {
    if (node.type === 'upload' && !rules.uploads) return 'Ta treść nie może zawierać zdjęć.'
    if (node.type === 'link' || node.type === 'autolink') {
      const fields = (node.fields ?? {}) as {
        linkType?: string
        url?: unknown
        doc?: { relationTo?: string }
      }
      if (fields.linkType !== 'internal' && !isSafeLinkUrl(fields.url)) {
        return 'Adres linku: ścieżka sklepu (/…), https://…, mailto: albo tel:.'
      }
      if (fields.linkType === 'internal') {
        const target = fields.doc?.relationTo
        if (!target || !rules.collections.includes(target)) {
          return (
            rules.linkMessage ??
            'Link wewnętrzny może prowadzić tylko do produktu, kategorii albo marki.'
          )
        }
      }
    }
    if (node.type === 'block' || node.type === 'inlineBlock') {
      const blockType = String(node.fields?.blockType ?? '')
      if (!(rules.blocks ?? []).includes(blockType)) return `Nieznany blok „${blockType}”.`
      const error = rules.blockError?.(blockType, (node.fields ?? {}) as Record<string, unknown>)
      if (error) return error
    }
  }
  return true
}
