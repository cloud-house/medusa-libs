import { PAGE_BLOCKS, SETTING_VALUE_OPTIONS } from '@cloud-house/commerce-rules'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $findMatchingParent } from '@lexical/utils'
import { Badge, Button, DropdownMenu, IconButton, Input, Label, Select, Text } from '@medusajs/ui'
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type EditorState,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  type NodeKey,
} from 'lexical'
import { createContext, type ReactNode, useContext, useState } from 'react'
import type { MediaDoc, RefDoc, RefKind, Related } from '../api'
import { MediaLibraryDrawer } from '../MediaPicker'
import { RefSearchDrawer, RelationField } from '../RelationPicker'
import {
  $createBlockNode,
  $createContentLinkNode,
  $createInlineBlockNode,
  $createUploadNode,
  $isContentLinkNode,
  BlockNode,
  CONTENT_NODES,
  type DecoratorData,
  decoratorViews,
  InlineBlockNode,
  type LinkFields,
  UploadNode,
} from './nodes'

/** What an editor allows – the same rules the backend checks on save. */
export interface EditorFeatures {
  headings: HeadingTagType[]
  uploads: boolean
  /** Internal link targets. */
  links: RefKind[]
  blocks: string[]
  inlineBlocks: string[]
}

export const PAGE_EDITOR: EditorFeatures = {
  headings: ['h2', 'h3'],
  uploads: true,
  links: ['page', 'article', 'product', 'category', 'brand'],
  blocks: [PAGE_BLOCKS.sellerData, PAGE_BLOCKS.contactDetails, PAGE_BLOCKS.shippingRates],
  inlineBlocks: [PAGE_BLOCKS.settingValue],
}

export const ARTICLE_EDITOR: EditorFeatures = {
  headings: ['h2', 'h3'],
  uploads: true,
  links: ['page', 'article', 'product', 'category', 'brand'],
  blocks: ['productCards'],
  inlineBlocks: [],
}

export const CATEGORY_SEO_EDITOR: EditorFeatures = {
  headings: ['h2', 'h3'],
  uploads: false,
  links: ['product', 'category', 'brand'],
  blocks: [],
  inlineBlocks: [],
}

const RELATION_TO: Record<RefKind, string> = {
  page: 'pages',
  article: 'articles',
  product: 'product-content',
  category: 'category-content',
  brand: 'brand-content',
  article_category: 'article-categories',
}
const KIND_OF: Record<string, RefKind> = Object.fromEntries(
  Object.entries(RELATION_TO).map(([kind, relationTo]) => [relationTo, kind as RefKind]),
)
const RELATED_OF: Record<RefKind, keyof Related> = {
  page: 'entry',
  article: 'entry',
  article_category: 'entry',
  product: 'product',
  category: 'category',
  brand: 'brand',
}

export const BLOCK_LABELS: Record<string, string> = {
  sellerData: 'Dane sprzedawcy',
  contactDetails: 'Dane kontaktowe',
  shippingRates: 'Cennik dostawy',
  settingValue: 'Wartość z ustawień',
  productCards: 'Produkty',
}

interface EditorContextValue {
  related: Related
  remember: (kind: keyof Related, id: string, doc: RefDoc | MediaDoc) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)
const useEditorContext = () => {
  const value = useContext(EditorContext)
  if (!value) throw new Error('RichTextEditor context missing')
  return value
}

const blockId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

function updateNodeData(editor: LexicalEditor, key: NodeKey, data: DecoratorData) {
  editor.update(() => {
    const node = $getNodeByKey(key)
    if (
      node instanceof UploadNode ||
      node instanceof BlockNode ||
      node instanceof InlineBlockNode
    ) {
      node.setData(data)
    }
  })
}

function removeNode(editor: LexicalEditor, key: NodeKey) {
  editor.update(() => $getNodeByKey(key)?.remove())
}

function UploadView({ nodeKey, data }: { nodeKey: NodeKey; data: DecoratorData }) {
  const [editor] = useLexicalComposerContext()
  const { related } = useEditorContext()
  const media = related.media[String(data.value)]
  return (
    <div
      className="shadow-elevation-card-rest flex items-center gap-3 rounded-lg p-2"
      contentEditable={false}
    >
      {media ? (
        <img src={media.url} alt={media.alt} className="h-20 w-32 rounded object-cover" />
      ) : null}
      <Text size="small" className="flex-1">
        {media ? media.alt || media.filename : 'Zdjęcie usunięte z biblioteki'}
      </Text>
      <Button
        size="small"
        variant="transparent"
        type="button"
        onClick={() => removeNode(editor, nodeKey)}
      >
        Usuń
      </Button>
    </div>
  )
}

function BlockView({ nodeKey, data }: { nodeKey: NodeKey; data: DecoratorData }) {
  const [editor] = useLexicalComposerContext()
  const { related, remember } = useEditorContext()
  const fields = (data.fields ?? {}) as Record<string, unknown>
  const type = String(fields.blockType ?? '')
  return (
    <div
      className="shadow-elevation-card-rest bg-ui-bg-subtle flex flex-col gap-2 rounded-lg p-3"
      contentEditable={false}
    >
      <div className="flex items-center justify-between">
        <Badge size="small">Blok: {BLOCK_LABELS[type] ?? type}</Badge>
        <Button
          size="small"
          variant="transparent"
          type="button"
          onClick={() => removeNode(editor, nodeKey)}
        >
          Usuń
        </Button>
      </div>
      {type === 'productCards' ? (
        <RelationField
          label="Produkty (1–3)"
          kind="product"
          multiple
          max={3}
          value={fields.products}
          known={related.product}
          onChange={(value, picked) => {
            if (picked) remember('product', picked.id, picked)
            updateNodeData(editor, nodeKey, {
              ...data,
              fields: { ...fields, products: value ?? [] },
            })
          }}
        />
      ) : (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Treść bloku sklep bierze z ustawień sklepu i z Medusy w chwili wyświetlenia strony.
        </Text>
      )}
    </div>
  )
}

function InlineBlockView({ nodeKey, data }: { nodeKey: NodeKey; data: DecoratorData }) {
  const [editor] = useLexicalComposerContext()
  const fields = (data.fields ?? {}) as Record<string, unknown>
  return (
    <span contentEditable={false} className="inline-flex align-middle">
      <Select
        size="small"
        value={String(fields.key ?? '')}
        onValueChange={(key) =>
          updateNodeData(editor, nodeKey, { ...data, fields: { ...fields, key } })
        }
      >
        <Select.Trigger className="h-6 min-w-40">
          <Select.Value placeholder="Wartość z ustawień" />
        </Select.Trigger>
        <Select.Content>
          {SETTING_VALUE_OPTIONS.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </span>
  )
}

decoratorViews.upload = (key, data) => <UploadView nodeKey={key} data={data} />
decoratorViews.block = (key, data) => <BlockView nodeKey={key} data={data} />
decoratorViews.inlineBlock = (key, data) => <InlineBlockView nodeKey={key} data={data} />

function LinkDialog({ features, onClose }: { features: EditorFeatures; onClose: () => void }) {
  const [editor] = useLexicalComposerContext()
  const { remember } = useEditorContext()
  const [url, setUrl] = useState('')
  const [newTab, setNewTab] = useState(false)
  const [search, setSearch] = useState<RefKind | null>(null)

  const apply = (fields: LinkFields) => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const current = $findMatchingParent(selection.anchor.getNode(), $isContentLinkNode)
      if (current && $isContentLinkNode(current)) {
        current.setFields(fields)
        return
      }
      const text = selection.getTextContent()
      if (!text) return
      const link = $createContentLinkNode(fields)
      link.append($createTextNode(text))
      selection.insertNodes([link])
    })
    onClose()
  }

  return (
    <div className="shadow-elevation-flyout bg-ui-bg-base absolute z-10 mt-1 flex w-96 flex-col gap-3 rounded-lg p-3">
      <Label size="small" weight="plus">
        Adres linku
      </Label>
      <div className="flex gap-2">
        <Input
          size="small"
          placeholder="/kategoria, https://…, mailto:…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          size="small"
          type="button"
          disabled={!url.trim()}
          onClick={() => apply({ linkType: 'custom', url: url.trim(), newTab })}
        >
          Wstaw
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} /> W
        nowej karcie
      </label>
      <Label size="small" weight="plus">
        Albo dokument sklepu
      </Label>
      <div className="flex flex-wrap gap-2">
        {features.links.map((kind) => (
          <Button
            key={kind}
            size="small"
            variant="secondary"
            type="button"
            onClick={() => setSearch(kind)}
          >
            {
              {
                page: 'Strona',
                article: 'Artykuł',
                product: 'Produkt',
                category: 'Kategoria',
                brand: 'Marka',
                article_category: 'Kategoria Poradnika',
              }[kind]
            }
          </Button>
        ))}
      </div>
      <Button size="small" variant="transparent" type="button" onClick={onClose}>
        Anuluj
      </Button>
      {search ? (
        <RefSearchDrawer
          open
          kind={search}
          onClose={() => setSearch(null)}
          onPick={(doc) => {
            remember(RELATED_OF[search], doc.id, doc)
            apply({
              linkType: 'internal',
              newTab,
              doc: { relationTo: RELATION_TO[search], value: doc.id },
            })
          }}
        />
      ) : null}
    </div>
  )
}

function Toolbar({ features }: { features: EditorFeatures }) {
  const [editor] = useLexicalComposerContext()
  const { remember } = useEditorContext()
  const [linking, setLinking] = useState(false)
  const [picking, setPicking] = useState(false)

  const setBlock = (type: 'paragraph' | 'quote' | HeadingTagType) =>
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      $setBlocksType(selection, () =>
        type === 'paragraph'
          ? $createParagraphNode()
          : type === 'quote'
            ? $createQuoteNode()
            : $createHeadingNode(type),
      )
    })
  const unlink = () =>
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const link = $findMatchingParent(selection.anchor.getNode(), $isContentLinkNode)
      if (!link) return
      for (const child of link.getChildren()) link.insertBefore(child)
      link.remove()
    })
  const insertBlock = (blockType: string, inline: boolean) =>
    editor.update(() => {
      const fields: Record<string, unknown> = { id: blockId(), blockName: '', blockType }
      if (blockType === 'productCards') fields.products = []
      $insertNodes([
        inline
          ? $createInlineBlockNode({ version: 1, fields })
          : $createBlockNode({ format: '', version: 2, fields }),
      ])
    })

  const button = (label: string, onClick: () => void, title?: string) => (
    <Button
      key={label}
      size="small"
      variant="transparent"
      type="button"
      title={title ?? label}
      onClick={onClick}
    >
      {label}
    </Button>
  )

  return (
    <div className="border-ui-border-base relative flex flex-wrap items-center gap-1 border-b p-1">
      {button('B', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'), 'Pogrubienie')}
      {button('I', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'), 'Kursywa')}
      {button('U', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'), 'Podkreślenie')}
      {button('¶', () => setBlock('paragraph'), 'Akapit')}
      {features.headings.map((tag) =>
        button(tag.toUpperCase(), () => setBlock(tag), `Nagłówek ${tag.toUpperCase()}`),
      )}
      {button('„”', () => setBlock('quote'), 'Cytat')}
      {button('•', () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined), 'Lista')}
      {button(
        '1.',
        () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
        'Lista numerowana',
      )}
      {button('Link', () => setLinking((open) => !open))}
      {button('Bez linku', unlink, 'Usuń link')}
      {features.uploads ? button('Zdjęcie', () => setPicking(true)) : null}
      {button(
        '—',
        () => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
        'Linia pozioma',
      )}
      {features.blocks.length + features.inlineBlocks.length > 0 ? (
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton size="small" variant="transparent" type="button" className="w-auto px-2">
              Blok…
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {features.blocks.map((type) => (
              <DropdownMenu.Item key={type} onClick={() => insertBlock(type, false)}>
                {BLOCK_LABELS[type] ?? type}
              </DropdownMenu.Item>
            ))}
            {features.inlineBlocks.map((type) => (
              <DropdownMenu.Item key={type} onClick={() => insertBlock(type, true)}>
                {BLOCK_LABELS[type] ?? type} (w tekście)
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>
      ) : null}
      {linking ? <LinkDialog features={features} onClose={() => setLinking(false)} /> : null}
      <MediaLibraryDrawer
        open={picking}
        kind="image"
        onClose={() => setPicking(false)}
        onPick={(media) => {
          remember('media', media.id, media)
          editor.update(() => {
            $insertNodes([
              $createUploadNode({
                version: 3,
                format: '',
                id: blockId(),
                fields: null,
                relationTo: 'media',
                value: media.id,
              }),
            ])
          })
        }}
      />
    </div>
  )
}

/**
 * Lexical editor of pages, articles and category SEO blocks. `value` is read once – remount with
 * a new `key` to load other content (e.g. a restored version).
 */
export function RichTextEditor(props: {
  value: unknown
  onChange: (value: unknown) => void
  features: EditorFeatures
  related: Related
  onRelated: (kind: keyof Related, id: string, doc: RefDoc | MediaDoc) => void
  label?: string
}): ReactNode {
  const initial =
    props.value && typeof props.value === 'object' && 'root' in (props.value as object)
      ? JSON.stringify(props.value)
      : undefined
  const onChange = (state: EditorState) => props.onChange(state.toJSON())
  return (
    <EditorContext.Provider value={{ related: props.related, remember: props.onRelated }}>
      <div className="flex flex-col gap-1.5">
        {props.label ? (
          <Label size="small" weight="plus">
            {props.label}
          </Label>
        ) : null}
        <LexicalComposer
          initialConfig={{
            namespace: 'content-editor',
            nodes: CONTENT_NODES,
            editorState: initial,
            onError: (error) => {
              throw error
            },
            theme: {
              heading: {
                h2: 'text-xl font-semibold mt-4',
                h3: 'text-lg font-semibold mt-3',
                h4: 'font-semibold mt-2',
              },
              list: { ul: 'list-disc pl-6', ol: 'list-decimal pl-6' },
              quote: 'border-l-4 pl-3 italic text-ui-fg-subtle',
              paragraph: 'my-1',
              text: { bold: 'font-semibold', italic: 'italic', underline: 'underline' },
            },
          }}
        >
          <div className="shadow-borders-base bg-ui-bg-field rounded-md">
            <Toolbar features={props.features} />
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="txt-small min-h-48 px-3 py-2 outline-none" />
                }
                placeholder={
                  <div className="text-ui-fg-muted pointer-events-none absolute left-3 top-2 text-sm">
                    Wpisz treść…
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <HorizontalRulePlugin />
          <OnChangePlugin onChange={onChange} ignoreSelectionChange />
        </LexicalComposer>
      </div>
    </EditorContext.Provider>
  )
}

export { KIND_OF }
