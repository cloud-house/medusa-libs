import { ArrowDownMini, ArrowUpMini, Plus, Trash } from '@medusajs/icons'
import { Button, IconButton, Input, Label, Select, Switch, Text, Textarea } from '@medusajs/ui'
import type { ReactNode } from 'react'

export const str = (value: unknown) => (typeof value === 'string' ? value : '')

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {children}
      {hint ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      ) : null}
    </div>
  )
}

export function TextField(props: {
  label: string
  value: unknown
  onChange: (value: string) => void
  hint?: string
  multiline?: boolean
  placeholder?: string
}) {
  const value = str(props.value)
  return (
    <Field label={props.label} hint={props.hint}>
      {props.multiline ? (
        <Textarea
          value={value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <Input
          value={value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

export function NumberField(props: {
  label: string
  value: unknown
  onChange: (value: number) => void
  hint?: string
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      <Input
        type="number"
        value={typeof props.value === 'number' ? String(props.value) : ''}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </Field>
  )
}

export function Toggle(props: {
  label: string
  checked: unknown
  onChange: (value: boolean) => void
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={props.checked === true} onCheckedChange={props.onChange} />
      <div className="flex flex-col">
        <Label size="small" weight="plus">
          {props.label}
        </Label>
        {props.hint ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {props.hint}
          </Text>
        ) : null}
      </div>
    </div>
  )
}

export function SelectField(props: {
  label: string
  value: unknown
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  hint?: string
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      <Select value={str(props.value)} onValueChange={props.onChange}>
        <Select.Trigger>
          <Select.Value placeholder="Wybierz…" />
        </Select.Trigger>
        <Select.Content>
          {props.options.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </Field>
  )
}

/** Rows of an array field: add, remove and move, with the panel's row limit. */
export function ArrayField<T>(props: {
  label: string
  rows: unknown
  max: number
  empty: () => T
  onChange: (rows: T[]) => void
  render: (row: T, update: (row: T) => void, index: number) => ReactNode
  hint?: string
  addLabel?: string
}) {
  const rows = (Array.isArray(props.rows) ? props.rows : []) as T[]
  const set = (next: T[]) => props.onChange(next)
  const move = (index: number, by: number) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + by, 0, row as T)
    set(next)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label size="small" weight="plus">
          {props.label}
          <span className="text-ui-fg-muted ml-2">
            {rows.length}/{props.max}
          </span>
        </Label>
        <Button
          size="small"
          variant="secondary"
          type="button"
          disabled={rows.length >= props.max}
          onClick={() => set([...rows, props.empty()])}
        >
          <Plus /> {props.addLabel ?? 'Dodaj'}
        </Button>
      </div>
      {props.hint ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {props.hint}
        </Text>
      ) : null}
      {rows.map((row, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no ids; every field is controlled by the row's value.
        <div key={index} className="shadow-elevation-card-rest flex gap-3 rounded-lg p-3">
          <div className="flex flex-1 flex-col gap-3">
            {props.render(row, (next) => set(rows.map((r, i) => (i === index ? next : r))), index)}
          </div>
          <div className="flex flex-col gap-1">
            <IconButton
              size="small"
              variant="transparent"
              type="button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label="W górę"
            >
              <ArrowUpMini />
            </IconButton>
            <IconButton
              size="small"
              variant="transparent"
              type="button"
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
              aria-label="W dół"
            >
              <ArrowDownMini />
            </IconButton>
            <IconButton
              size="small"
              variant="transparent"
              type="button"
              onClick={() => set(rows.filter((_, i) => i !== index))}
              aria-label="Usuń"
            >
              <Trash />
            </IconButton>
          </div>
        </div>
      ))}
    </div>
  )
}
