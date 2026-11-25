import {
  CORE_HOME_BLOCK_LABELS,
  CORE_HOME_BLOCK_TYPES,
  CORE_SINGLE_HOME_BLOCKS,
  HOME_TOKENS,
} from '@cloud-house/commerce-rules'
import { ArrowDownMini, ArrowUpMini, Trash } from '@medusajs/icons'
import { Badge, Button, DropdownMenu, IconButton, Text } from '@medusajs/ui'
import { useState } from 'react'
import { homeBlockUi, homeBlockUis } from '../../lib/ui-registry'
import type { Data, Related } from './api'
import { ArrayField, SelectField, str, TextField } from './fields'
import { MediaField } from './MediaPicker'
import { RelationField } from './RelationPicker'
import type { EntryEditor } from './useEntryEditor'

const TOKENS_HINT = `Możesz wstawić wartości z ustawień sklepu: ${Object.keys(HOME_TOKENS)
  .map((name) => `{${name}}`)
  .join(', ')}.`

type Block = Data & { id: string; blockType: string }

const blockId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

const EMPTY: Record<string, () => Data> = {
  hero: () => ({
    title: '',
    image: null,
    cta: { label: '', href: '' },
    secondaryCta: { label: '', href: '' },
    product: null,
  }),
  trustBar: () => ({ items: [{ title: '' }, { title: '' }] }),
  categoryTiles: () => ({ heading: '', intro: '', tiles: [] }),
  brands: () => ({ heading: '', text: '', link: { label: '', href: '' } }),
  productTabs: () => ({
    tabs: [{ label: 'Popularne', sort: 'popular', category: null }],
    link: { label: '', href: '' },
  }),
  newsletter: () => ({ heading: '', text: '', image: null }),
  articles: () => ({
    heading: 'Z Poradnika',
    link: { label: 'Wszystkie artykuły', href: '/poradnik' },
  }),
}

function LinkFields(props: { label: string; value: unknown; onChange: (value: Data) => void }) {
  const link = (props.value ?? {}) as Data
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField
        label={`${props.label} – etykieta`}
        value={link.label}
        onChange={(label) => props.onChange({ ...link, label })}
      />
      <TextField
        label={`${props.label} – adres`}
        value={link.href}
        placeholder="/kategoria"
        onChange={(href) => props.onChange({ ...link, href })}
      />
    </div>
  )
}

function BlockForm({
  block,
  set,
  related,
  remember,
}: {
  block: Block
  set: (patch: Data) => void
  related: Related
  remember: EntryEditor['remember']
}) {
  const media = (label: string, key: string, hint?: string) => (
    <MediaField
      label={label}
      hint={hint}
      value={block[key]}
      media={related.media}
      onChange={(id, doc) => {
        if (doc) remember('media', doc.id, doc)
        set({ [key]: id })
      }}
    />
  )
  const text = (label: string, key: string, multiline = false) => (
    <TextField
      label={label}
      value={block[key]}
      multiline={multiline}
      onChange={(value) => set({ [key]: value })}
    />
  )
  switch (block.blockType) {
    case 'hero':
      return (
        <>
          {text('Nadtytuł', 'eyebrow')}
          {text('Tytuł (H1)', 'title')}
          {media('Zdjęcie', 'image')}
          <LinkFields label="Przycisk" value={block.cta} onChange={(cta) => set({ cta })} />
          <LinkFields
            label="Drugi przycisk (opcjonalny)"
            value={block.secondaryCta}
            onChange={(secondaryCta) => set({ secondaryCta })}
          />
          <RelationField
            label="Na zdjęciu (produkt)"
            kind="product"
            value={block.product}
            known={related.product}
            hint="Karta z nazwą i ceną w rogu zdjęcia."
            onChange={(product, picked) => {
              if (picked) remember('product', picked.id, picked)
              set({ product })
            }}
          />
        </>
      )
    case 'trustBar':
      return (
        <ArrayField<Data>
          label="Pozycje"
          rows={block.items}
          max={4}
          empty={() => ({ title: '', text: '' })}
          onChange={(items) => set({ items })}
          render={(row, update) => (
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Tytuł"
                value={row.title}
                onChange={(title) => update({ ...row, title })}
              />
              <TextField
                label="Podpis"
                value={row.text}
                onChange={(value) => update({ ...row, text: value })}
              />
            </div>
          )}
        />
      )
    case 'categoryTiles':
      return (
        <>
          {text('Nagłówek', 'heading')}
          {text('Wstęp', 'intro', true)}
          <ArrayField<Data>
            label="Kafle"
            rows={block.tiles}
            max={6}
            hint="Od 2 do 6 kafli."
            empty={() => ({ category: null, subtitle: '', image: null })}
            onChange={(tiles) => set({ tiles })}
            render={(row, update) => (
              <>
                <RelationField
                  label="Kategoria"
                  kind="category"
                  value={row.category}
                  known={related.category}
                  onChange={(category, picked) => {
                    if (picked) remember('category', picked.id, picked)
                    update({ ...row, category })
                  }}
                />
                <TextField
                  label="Podpis"
                  value={row.subtitle}
                  onChange={(subtitle) => update({ ...row, subtitle })}
                />
                <MediaField
                  label="Zdjęcie"
                  hint="Puste – zdjęcie z hero kategorii."
                  value={row.image}
                  media={related.media}
                  onChange={(image, doc) => {
                    if (doc) remember('media', doc.id, doc)
                    update({ ...row, image })
                  }}
                />
              </>
            )}
          />
        </>
      )
    case 'brands':
      return (
        <>
          {text('Nadtytuł', 'eyebrow')}
          {text('Nagłówek', 'heading')}
          {text('Tekst', 'text', true)}
          <LinkFields label="Link" value={block.link} onChange={(link) => set({ link })} />
        </>
      )
    case 'productTabs':
      return (
        <>
          <ArrayField<Data>
            label="Zakładki"
            rows={block.tabs}
            max={3}
            hint="Każda zakładka pokazuje 4 produkty z katalogu."
            empty={() => ({ label: '', sort: 'popular', category: null })}
            onChange={(tabs) => set({ tabs })}
            render={(row, update) => (
              <>
                <TextField
                  label="Etykieta"
                  value={row.label}
                  onChange={(label) => update({ ...row, label })}
                />
                <SelectField
                  label="Kolejność"
                  value={row.sort}
                  options={[
                    { value: 'popular', label: 'Popularne' },
                    { value: 'newest', label: 'Najnowsze' },
                  ]}
                  onChange={(sort) => update({ ...row, sort })}
                />
                <RelationField
                  label="Kategoria"
                  kind="category"
                  value={row.category}
                  known={related.category}
                  hint="Puste – cały katalog."
                  onChange={(category, picked) => {
                    if (picked) remember('category', picked.id, picked)
                    update({ ...row, category })
                  }}
                />
              </>
            )}
          />
          <LinkFields label="Link" value={block.link} onChange={(link) => set({ link })} />
        </>
      )
    case 'newsletter':
      return (
        <>
          {text('Nadtytuł', 'eyebrow')}
          {text('Nagłówek', 'heading')}
          {text('Tekst', 'text', true)}
          {media('Zdjęcie', 'image')}
        </>
      )
    case 'articles':
      return (
        <>
          {text('Nagłówek', 'heading')}
          <LinkFields label="Link" value={block.link} onChange={(link) => set({ link })} />
        </>
      )
    default: {
      const extra = homeBlockUi(block.blockType)
      return extra ? (
        extra.render({ block, set, related, remember: remember as never })
      ) : (
        <Text size="small">Nieznany blok.</Text>
      )
    }
  }
}

/** Home page layout: add, reorder, collapse and remove blocks; the rules are checked on publish. */
export function HomeBlocksEditor({ editor }: { editor: EntryEditor }) {
  const blocks = (Array.isArray(editor.data?.layout) ? editor.data.layout : []) as Block[]
  const [open, setOpen] = useState<string | null>(null)
  const setBlocks = (layout: Block[]) => editor.update({ layout })
  const move = (index: number, by: number) => {
    const next = [...blocks]
    const [block] = next.splice(index, 1)
    next.splice(index + by, 0, block as Block)
    setBlocks(next)
  }
  const used = new Set(blocks.map((block) => block.blockType))
  const available = [
    ...CORE_HOME_BLOCK_TYPES.map((type) => ({
      type: type as string,
      label: CORE_HOME_BLOCK_LABELS[type],
      single: CORE_SINGLE_HOME_BLOCKS.includes(type),
      empty: EMPTY[type] as () => Data,
    })),
    ...homeBlockUis(),
  ].filter((block) => !(block.single && used.has(block.type)))
  const labelOf = (type: string) =>
    (CORE_HOME_BLOCK_LABELS as Record<string, string>)[type] ?? homeBlockUi(type)?.label ?? type
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Text size="small" className="text-ui-fg-subtle">
          Hero musi być pierwszy; hero, pasek zalet i newsletter – najwyżej raz. {TOKENS_HINT}
        </Text>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button size="small" variant="secondary">
              Dodaj blok
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {available.map(({ type, label, empty }) => (
              <DropdownMenu.Item
                key={type}
                onClick={() => {
                  const block = { id: blockId(), blockType: type, ...empty() } as Block
                  setBlocks(type === 'hero' ? [block, ...blocks] : [...blocks, block])
                  setOpen(block.id)
                }}
              >
                {label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="shadow-elevation-card-rest flex flex-col gap-3 rounded-lg p-3"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex flex-1 items-center gap-2 text-left"
              onClick={() => setOpen(open === block.id ? null : block.id)}
            >
              <Badge size="small">{labelOf(block.blockType)}</Badge>
              <Text size="small" className="text-ui-fg-subtle truncate">
                {str(block.title) || str(block.heading) || str(block.hashtag)}
              </Text>
            </button>
            <IconButton
              size="small"
              variant="transparent"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label="W górę"
            >
              <ArrowUpMini />
            </IconButton>
            <IconButton
              size="small"
              variant="transparent"
              disabled={index === blocks.length - 1}
              onClick={() => move(index, 1)}
              aria-label="W dół"
            >
              <ArrowDownMini />
            </IconButton>
            <IconButton
              size="small"
              variant="transparent"
              onClick={() => setBlocks(blocks.filter((other) => other.id !== block.id))}
              aria-label="Usuń blok"
            >
              <Trash />
            </IconButton>
          </div>
          {open === block.id ? (
            <div className="flex flex-col gap-4 border-t pt-3">
              <BlockForm
                block={block}
                related={editor.related}
                remember={editor.remember}
                set={(patch) =>
                  setBlocks(
                    blocks.map((other) => (other.id === block.id ? { ...other, ...patch } : other)),
                  )
                }
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
