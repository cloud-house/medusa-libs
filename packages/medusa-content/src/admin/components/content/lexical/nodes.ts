import { ListItemNode, ListNode } from '@lexical/list'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import {
  $applyNodeReplacement,
  DecoratorNode,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { ReactNode } from 'react'

/**
 * Nodes of the content editor, saved in exactly the JSON the shop renders (the format of the
 * previous panel): links with `fields`, uploads with `relationTo` / `value`, blocks with `fields`.
 */

export interface LinkFields {
  linkType: 'custom' | 'internal'
  url?: string
  newTab?: boolean
  doc?: { relationTo: string; value: string } | null
  [key: string]: unknown
}

type SerializedLink = Spread<{ fields: LinkFields }, SerializedElementNode>

function linkDom(fields: LinkFields): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = fields.linkType === 'custom' ? (fields.url ?? '#') : '#'
  a.className = 'text-ui-fg-interactive underline'
  if (fields.linkType === 'internal') a.dataset.internal = fields.doc?.relationTo ?? ''
  return a
}

export class ContentLinkNode extends ElementNode {
  __fields: LinkFields

  static getType(): string {
    return 'link'
  }

  static clone(node: ContentLinkNode): ContentLinkNode {
    return new ContentLinkNode({ ...node.__fields }, node.__key)
  }

  constructor(fields: LinkFields, key?: NodeKey) {
    super(key)
    this.__fields = fields
  }

  static importJSON(json: SerializedLink): ContentLinkNode {
    return $createContentLinkNode(json.fields).updateFromJSON(json)
  }

  exportJSON(): SerializedLink {
    return { ...super.exportJSON(), fields: this.getLatest().__fields, type: 'link', version: 3 }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return linkDom(this.__fields)
  }

  updateDOM(prev: ContentLinkNode, dom: HTMLElement): boolean {
    if (prev.__fields !== this.__fields && dom instanceof HTMLAnchorElement) {
      dom.href = this.__fields.linkType === 'custom' ? (this.__fields.url ?? '#') : '#'
    }
    return false
  }

  getFields(): LinkFields {
    return this.getLatest().__fields
  }

  setFields(fields: LinkFields): this {
    const writable = this.getWritable()
    writable.__fields = fields
    return writable
  }

  isInline(): true {
    return true
  }

  canInsertTextBefore(): false {
    return false
  }

  canInsertTextAfter(): false {
    return false
  }

  canBeEmpty(): false {
    return false
  }
}

/** A link the editor typed as plain text (`https://…`) – kept as it was saved. */
export class ContentAutoLinkNode extends ContentLinkNode {
  static getType(): string {
    return 'autolink'
  }

  static clone(node: ContentAutoLinkNode): ContentAutoLinkNode {
    return new ContentAutoLinkNode({ ...node.__fields }, node.__key)
  }

  static importJSON(json: SerializedLink): ContentAutoLinkNode {
    return new ContentAutoLinkNode(json.fields).updateFromJSON(json)
  }

  exportJSON(): SerializedLink {
    return { ...super.exportJSON(), type: 'autolink', version: 2 }
  }
}

export function $createContentLinkNode(fields: LinkFields): ContentLinkNode {
  return $applyNodeReplacement(new ContentLinkNode(fields))
}

export const $isContentLinkNode = (node: LexicalNode | null | undefined): node is ContentLinkNode =>
  node instanceof ContentLinkNode

/** Everything a decorator saves – kept whole, so keys the panel does not edit survive a save. */
export type DecoratorData = Record<string, unknown>

/** UI of decorators, registered by the editor (the nodes stay free of React components for tests). */
export const decoratorViews: {
  upload?: (key: NodeKey, data: DecoratorData) => ReactNode
  block?: (key: NodeKey, data: DecoratorData) => ReactNode
  inlineBlock?: (key: NodeKey, data: DecoratorData) => ReactNode
} = {}

abstract class DataNode extends DecoratorNode<ReactNode> {
  __data: DecoratorData

  constructor(data: DecoratorData, key?: NodeKey) {
    super(key)
    this.__data = data
  }

  getData(): DecoratorData {
    return this.getLatest().__data
  }

  setData(data: DecoratorData): this {
    const writable = this.getWritable()
    writable.__data = data
    return writable
  }

  exportJSON(): SerializedLexicalNode {
    const type = this.getType()
    return { ...this.getLatest().__data, type, version: Number(this.__data.version ?? 1) }
  }

  updateDOM(): false {
    return false
  }
}

export class UploadNode extends DataNode {
  static getType(): string {
    return 'upload'
  }

  static clone(node: UploadNode): UploadNode {
    return new UploadNode(node.__data, node.__key)
  }

  static importJSON(json: SerializedLexicalNode): UploadNode {
    const { type: _type, ...data } = json as SerializedLexicalNode & DecoratorData
    return new UploadNode(data)
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'my-2'
    return div
  }

  isInline(): false {
    return false
  }

  decorate(): ReactNode {
    return decoratorViews.upload?.(this.__key, this.__data) ?? null
  }
}

export class BlockNode extends DataNode {
  static getType(): string {
    return 'block'
  }

  static clone(node: BlockNode): BlockNode {
    return new BlockNode(node.__data, node.__key)
  }

  static importJSON(json: SerializedLexicalNode): BlockNode {
    const { type: _type, ...data } = json as SerializedLexicalNode & DecoratorData
    return new BlockNode(data)
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'my-2'
    return div
  }

  isInline(): false {
    return false
  }

  decorate(): ReactNode {
    return decoratorViews.block?.(this.__key, this.__data) ?? null
  }
}

export class InlineBlockNode extends DataNode {
  static getType(): string {
    return 'inlineBlock'
  }

  static clone(node: InlineBlockNode): InlineBlockNode {
    return new InlineBlockNode(node.__data, node.__key)
  }

  static importJSON(json: SerializedLexicalNode): InlineBlockNode {
    const { type: _type, ...data } = json as SerializedLexicalNode & DecoratorData
    return new InlineBlockNode(data)
  }

  createDOM(): HTMLElement {
    return document.createElement('span')
  }

  isInline(): true {
    return true
  }

  decorate(): ReactNode {
    return decoratorViews.inlineBlock?.(this.__key, this.__data) ?? null
  }
}

export const $createUploadNode = (data: DecoratorData) => new UploadNode(data)
export const $createBlockNode = (data: DecoratorData) => new BlockNode(data)
export const $createInlineBlockNode = (data: DecoratorData) => new InlineBlockNode(data)

/** Every node the content editors may contain. */
export const CONTENT_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  HorizontalRuleNode,
  ContentLinkNode,
  ContentAutoLinkNode,
  UploadNode,
  BlockNode,
  InlineBlockNode,
]
