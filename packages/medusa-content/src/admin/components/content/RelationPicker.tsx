import { XMark } from '@medusajs/icons'
import { Badge, Button, Drawer, IconButton, Input, Text } from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { contentKey, type RefDoc, type RefKind, refLabel, searchRefs } from './api'
import { Field } from './fields'

const TITLES: Record<RefKind, string> = {
  product: 'Wybierz produkt',
  category: 'Wybierz kategorię',
  brand: 'Wybierz markę',
  page: 'Wybierz stronę',
  article: 'Wybierz artykuł',
  article_category: 'Wybierz kategorię Poradnika',
}

export function RefSearchDrawer(props: {
  open: boolean
  kind: RefKind
  onClose: () => void
  onPick: (doc: RefDoc) => void
}) {
  const [q, setQ] = useState('')
  const results = useQuery({
    queryKey: contentKey('refs', props.kind, q),
    queryFn: () => searchRefs(props.kind, q),
    enabled: props.open,
  })
  return (
    <Drawer open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{TITLES[props.kind]}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
          <Input placeholder="Szukaj" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          {(results.data ?? []).map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="hover:bg-ui-bg-base-hover flex flex-col rounded-md px-3 py-2 text-left"
              onClick={() => {
                props.onPick(doc)
                props.onClose()
              }}
            >
              <Text size="small" weight="plus">
                {refLabel(doc, doc.id)}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {doc.handle ?? doc.slug ?? ''}
              </Text>
            </button>
          ))}
          {results.data?.length === 0 ? <Text size="small">Nic nie znaleziono.</Text> : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}

/** Relation to one or many documents; stores ids, shows names from `known`. */
export function RelationField(props: {
  label: string
  kind: RefKind
  value: unknown
  known: Record<string, RefDoc>
  onChange: (value: string | string[] | null, picked?: RefDoc) => void
  multiple?: boolean
  max?: number
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const ids = props.multiple
    ? (Array.isArray(props.value) ? props.value : []).filter(
        (id): id is string => typeof id === 'string',
      )
    : typeof props.value === 'string' && props.value
      ? [props.value]
      : []
  const full = props.multiple ? ids.length >= (props.max ?? Number.POSITIVE_INFINITY) : false
  const remove = (id: string) =>
    props.onChange(props.multiple ? ids.filter((other) => other !== id) : null)
  return (
    <Field label={props.label} hint={props.hint}>
      <div className="flex flex-wrap items-center gap-2">
        {ids.map((id) => (
          <Badge key={id} size="small" className="flex items-center gap-1">
            {props.known[id] ? refLabel(props.known[id], id) : 'Usunięty dokument'}
            <IconButton
              size="2xsmall"
              variant="transparent"
              type="button"
              aria-label="Usuń"
              onClick={() => remove(id)}
            >
              <XMark />
            </IconButton>
          </Badge>
        ))}
        {!full ? (
          <Button size="small" variant="secondary" type="button" onClick={() => setOpen(true)}>
            {props.multiple || ids.length === 0 ? 'Wybierz' : 'Zmień'}
          </Button>
        ) : null}
      </div>
      <RefSearchDrawer
        open={open}
        kind={props.kind}
        onClose={() => setOpen(false)}
        onPick={(doc) =>
          props.onChange(
            props.multiple ? [...ids.filter((id) => id !== doc.id), doc.id] : doc.id,
            doc,
          )
        }
      />
    </Field>
  )
}
