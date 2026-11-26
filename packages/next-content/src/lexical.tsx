import { type CSSProperties, Fragment, type ReactNode } from 'react'

/** A node of the saved Lexical editor state (the shape the content panel saves). */
export type LexicalNode = {
  type?: string
  children?: LexicalNode[]
  text?: string
  format?: number | string
  tag?: string
  listType?: string
  value?: unknown
  checked?: boolean
  fields?: Record<string, unknown>
  [key: string]: unknown
}

type Render = (nodes: LexicalNode[] | undefined) => ReactNode[]

/** Custom output for the shop's nodes; `undefined` – the default converter. */
export interface LexicalConverters {
  heading?: (node: LexicalNode, children: ReactNode[]) => ReactNode
  link?: (node: LexicalNode, children: ReactNode[]) => ReactNode
  autolink?: (node: LexicalNode, children: ReactNode[]) => ReactNode
  upload?: (node: LexicalNode) => ReactNode
  blocks?: Record<string, (node: LexicalNode) => ReactNode>
  inlineBlocks?: Record<string, (node: LexicalNode) => ReactNode>
}

// Lexical text format bits.
const BOLD = 1
const ITALIC = 2
const STRIKETHROUGH = 4
const UNDERLINE = 8
const CODE = 16
const SUBSCRIPT = 32
const SUPERSCRIPT = 64

const ALIGN = new Set(['left', 'center', 'right', 'justify', 'start', 'end'])
const alignStyle = (node: LexicalNode): CSSProperties | undefined =>
  typeof node.format === 'string' && ALIGN.has(node.format)
    ? { textAlign: node.format as CSSProperties['textAlign'] }
    : undefined

function text(node: LexicalNode): ReactNode {
  let out: ReactNode = node.text ?? ''
  const format = typeof node.format === 'number' ? node.format : 0
  if (format & BOLD) out = <strong>{out}</strong>
  if (format & ITALIC) out = <em>{out}</em>
  if (format & STRIKETHROUGH) out = <span style={{ textDecoration: 'line-through' }}>{out}</span>
  if (format & UNDERLINE) out = <span style={{ textDecoration: 'underline' }}>{out}</span>
  if (format & CODE) out = <code>{out}</code>
  if (format & SUBSCRIPT) out = <sub>{out}</sub>
  if (format & SUPERSCRIPT) out = <sup>{out}</sup>
  return out
}

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function convert(node: LexicalNode, render: Render, converters: LexicalConverters): ReactNode {
  const children = () => render(node.children)
  switch (node.type) {
    case 'text':
      return text(node)
    case 'linebreak':
      return <br />
    case 'tab':
      return '\t'
    case 'paragraph': {
      const content = children()
      return <p style={alignStyle(node)}>{content.length ? content : <br />}</p>
    }
    case 'heading': {
      const content = children()
      if (converters.heading) return converters.heading(node, content)
      const Tag = (HEADINGS.has(String(node.tag)) ? node.tag : 'h2') as 'h2'
      return <Tag style={alignStyle(node)}>{content}</Tag>
    }
    case 'quote':
      return <blockquote>{children()}</blockquote>
    case 'list': {
      const Tag = node.tag === 'ol' || node.listType === 'number' ? 'ol' : 'ul'
      return <Tag className={`list-${node.listType ?? 'bullet'}`}>{children()}</Tag>
    }
    case 'listitem':
      return <li value={typeof node.value === 'number' ? node.value : undefined}>{children()}</li>
    case 'horizontalrule':
      return <hr />
    case 'link':
      return converters.link ? converters.link(node, children()) : children()
    case 'autolink': {
      const convert = converters.autolink ?? converters.link
      return convert ? convert(node, children()) : children()
    }
    case 'upload':
      return converters.upload?.(node) ?? null
    case 'block': {
      const blockType = String(node.fields?.blockType ?? '')
      return converters.blocks?.[blockType]?.(node) ?? null
    }
    case 'inlineBlock': {
      const blockType = String(node.fields?.blockType ?? '')
      return converters.inlineBlocks?.[blockType]?.(node) ?? null
    }
    default:
      // A node from a newer editor the shop does not know yet – its text, if any.
      return node.children ? children() : null
  }
}

/** Saved Lexical content (`{ root }`) → JSX, without the editor library in the shop's bundle. */
export function renderLexical(data: unknown, converters: LexicalConverters = {}): ReactNode {
  const root = (data as { root?: LexicalNode } | null)?.root
  if (!root) return null
  const render: Render = (nodes) =>
    (nodes ?? []).map((node, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: saved content has no ids; order is fixed per render
      <Fragment key={index}>{convert(node, render, converters)}</Fragment>
    ))
  return <>{render(root.children)}</>
}
