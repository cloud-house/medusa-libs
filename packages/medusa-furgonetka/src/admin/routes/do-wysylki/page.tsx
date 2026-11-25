import { defineRouteConfig } from '@medusajs/admin-sdk'
import { TruckFast } from '@medusajs/icons'
import {
  Alert,
  Button,
  Checkbox,
  Container,
  FocusModal,
  Heading,
  Input,
  Label,
  RadioGroup,
  Table,
  Text,
  toast,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PickupWindow } from '../../../lib/pickup'
import type { CreateResult, QueueRow, ShippingQueueResponse } from '../../../lib/queue-types'
import { zl } from '../../lib/money'
import { errorMessage, sdk } from '../../lib/sdk'
import {
  batchToast,
  carrierSummary,
  deliveryLabel,
  orderDateText,
  ordersCount,
  parcelsLabel,
  queueStateLabel,
  resultLabel,
} from '../../lib/shipment-labels'

const QUEUE_KEY = ['furgonetka', 'shipping-queue']

type Kind = 'create' | 'pickup'
type Way = 'courier' | 'drop_off'

/** The outcome of the last batch for an order, shown in its row. */
type Outcome = { text: string; ok: boolean }

const orderLink = (row: QueueRow) => `/orders/${row.orderId}`

function ShipmentDialog({
  kind,
  rows,
  initial,
  onClose,
  onDone,
}: {
  kind: Kind
  rows: QueueRow[]
  initial: PickupWindow
  onClose: () => void
  onDone: (results: CreateResult[]) => void
}) {
  const [way, setWay] = useState<Way>('courier')
  const [term, setTerm] = useState<PickupWindow>(initial)
  const asCourier = kind === 'pickup' || way === 'courier'
  const valid = !asCourier || (term.date !== '' && term.from !== '' && term.from < term.to)

  const send = useMutation({
    mutationFn: () =>
      kind === 'create'
        ? sdk.client.fetch<{ results: CreateResult[] }>('/admin/shipping/shipments', {
            method: 'POST',
            body: {
              order_ids: rows.map((row) => row.orderId),
              pickup: way === 'courier' ? { type: 'courier', ...term } : { type: 'drop_off' },
            },
          })
        : sdk.client.fetch<{ results: CreateResult[] }>('/admin/shipping/pickups', {
            method: 'POST',
            body: { shipment_ids: rows.map((row) => row.shipmentId), pickup: term },
          }),
    onSuccess: ({ results }) => onDone(results),
    onError: (error) => toast.error(errorMessage(error)),
  })

  const title = kind === 'create' ? `Utwórz przesyłki (${rows.length})` : 'Zamów odbiór'
  return (
    <FocusModal open onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center justify-end gap-x-2">
            <FocusModal.Close asChild>
              <Button size="small" variant="secondary">
                Anuluj
              </Button>
            </FocusModal.Close>
            <Button
              size="small"
              disabled={!valid}
              isLoading={send.isPending}
              onClick={() => send.mutate()}
            >
              {kind === 'create' ? 'Utwórz przesyłki' : 'Zamów odbiór'}
            </Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-16">
          <div className="flex w-full max-w-lg flex-col gap-y-8">
            <div className="flex flex-col gap-y-1">
              <FocusModal.Title asChild>
                <Heading>{title}</Heading>
              </FocusModal.Title>
              <FocusModal.Description asChild>
                <Text className="text-ui-fg-subtle">
                  {kind === 'create'
                    ? `Przesyłki według przewoźnika – ${carrierSummary(rows)}.`
                    : `Zamówienie odbioru dla przesyłek: ${rows.length}.`}
                </Text>
              </FocusModal.Description>
            </div>
            {kind === 'create' && (
              <RadioGroup value={way} onValueChange={(value) => setWay(value as Way)}>
                <RadioGroup.ChoiceBox
                  value="courier"
                  label="Kurier odbierze"
                  description="Odbiór zamawiamy razem z przesyłkami, w wybranym terminie."
                />
                <RadioGroup.ChoiceBox
                  value="drop_off"
                  label="Nadam w punkcie/paczkomacie"
                  description="Przesyłki nadajesz sam, odbioru nie zamawiamy."
                />
              </RadioGroup>
            )}
            {asCourier && (
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="pickup-date">Dzień odbioru</Label>
                  <Input
                    id="pickup-date"
                    type="date"
                    value={term.date}
                    onChange={(event) => setTerm({ ...term, date: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="pickup-from">Od godziny</Label>
                  <Input
                    id="pickup-from"
                    type="time"
                    value={term.from}
                    onChange={(event) => setTerm({ ...term, from: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="pickup-to">Do godziny</Label>
                  <Input
                    id="pickup-to"
                    type="time"
                    value={term.to}
                    onChange={(event) => setTerm({ ...term, to: event.target.value })}
                  />
                </div>
              </div>
            )}
            {asCourier && !valid && (
              <Text size="small" className="text-ui-fg-error">
                Podaj dzień i godziny odbioru – początek przed końcem.
              </Text>
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

function StateCell({ row, outcome }: { row: QueueRow; outcome?: Outcome }) {
  const state = queueStateLabel(row)
  // A new order with problems has nothing to say about its state yet – the problems come first.
  const showState = row.problems.length === 0 || row.state !== 'new'
  return (
    <div className="flex flex-col gap-y-1">
      {row.problems.map((problem) => (
        <Text key={problem} size="small" className="text-ui-fg-error">
          {problem}
        </Text>
      ))}
      {row.problems.length > 0 && (
        <Link to={orderLink(row)} className="text-ui-fg-interactive text-small">
          Otwórz kartę „Wysyłka”
        </Link>
      )}
      {showState && (
        <Text size="small" className={row.state === 'failed' ? 'text-ui-fg-error' : undefined}>
          {state}
        </Text>
      )}
      {row.state === 'ready' && row.error && (
        <Text size="small" className="text-ui-fg-subtle">
          {row.error}
        </Text>
      )}
      {outcome && outcome.text !== state && (
        <Text size="small" className={outcome.ok ? 'text-ui-fg-subtle' : 'text-ui-fg-error'}>
          {outcome.text}
        </Text>
      )}
    </div>
  )
}

const ShippingQueuePage = () => {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<Kind | null>(null)
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})
  const { data, isLoading, error } = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => sdk.client.fetch<ShippingQueueResponse>('/admin/shipping/queue'),
  })

  const rows = data?.rows ?? []
  const blockers = data?.blockers ?? []
  const selectable = rows.filter((row) => row.selectable)
  // Rows that left the list or became unselectable drop out of the selection by themselves.
  const chosen = selectable.filter((row) => selected.has(row.orderId))
  const toCreate = chosen.filter((row) => row.state !== 'ready')
  const ready = chosen.filter((row) => row.state === 'ready' && row.shipmentId)
  const toPickup = ready.filter((row) => row.pickupStatus === 'failed')
  const blocked = blockers.length > 0

  function toggle(row: QueueRow, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(row.orderId)
      else next.delete(row.orderId)
      return next
    })
    setOutcomes(({ [row.orderId]: _gone, ...rest }) => rest)
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(selectable.map((row) => row.orderId)) : new Set())
  }

  function print() {
    const ids = ready.map((row) => encodeURIComponent(row.shipmentId as string))
    window.open(`/admin/shipping/labels?ids=${ids.join(',')}`, '_blank')
  }

  function finished(kind: Kind, results: CreateResult[]) {
    const { kind: level, text } = batchToast(results, kind)
    toast[level](text)
    setOutcomes((current) => ({
      ...current,
      ...Object.fromEntries(
        results
          .filter((result) => result.orderId)
          .map((result) => [
            result.orderId,
            { text: resultLabel(result, kind), ok: result.ok } satisfies Outcome,
          ]),
      ),
    }))
    // What went through leaves the selection; what did not stays for another try.
    const done = new Set(results.filter((result) => result.ok).map((result) => result.orderId))
    setSelected((current) => new Set([...current].filter((orderId) => !done.has(orderId))))
    setDialog(null)
    queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
  }

  const allSelected = selectable.length > 0 && chosen.length === selectable.length
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-4 px-6 py-4">
        <div>
          <Heading level="h1">Do wysyłki</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {ordersCount(rows.length)} – opłacone zamówienia ze sklepu bez przesyłki oraz przesyłki
            czekające na pierwszy skan przewoźnika.
          </Text>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="small"
            disabled={blocked || toCreate.length === 0}
            onClick={() => setDialog('create')}
          >
            Utwórz przesyłki ({toCreate.length})
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={blocked || ready.length === 0}
            onClick={print}
          >
            Drukuj etykiety ({ready.length})
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={blocked || toPickup.length === 0}
            onClick={() => setDialog('pickup')}
          >
            Zamów odbiór
          </Button>
        </div>
      </div>
      {blocked && (
        <div className="flex flex-col gap-2 px-6 py-4">
          {blockers.map((blocker) => (
            <Alert key={blocker} variant="warning">
              {blocker}
            </Alert>
          ))}
        </div>
      )}
      {error && (
        <div className="px-6 py-4">
          <Alert variant="error">{errorMessage(error)}</Alert>
        </div>
      )}
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell className="w-10">
              <Checkbox
                aria-label="Zaznacz wszystkie"
                disabled={selectable.length === 0}
                checked={allSelected ? true : chosen.length > 0 ? 'indeterminate' : false}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
            </Table.HeaderCell>
            <Table.HeaderCell>Zamówienie</Table.HeaderCell>
            <Table.HeaderCell>Klient</Table.HeaderCell>
            <Table.HeaderCell>Data</Table.HeaderCell>
            <Table.HeaderCell>Dostawa</Table.HeaderCell>
            <Table.HeaderCell>Paczki</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Wartość</Table.HeaderCell>
            <Table.HeaderCell>Stan</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.orderId}>
              <Table.Cell>
                <Checkbox
                  aria-label={`Zaznacz zamówienie #${row.displayId}`}
                  disabled={!row.selectable}
                  checked={selected.has(row.orderId) && row.selectable}
                  onCheckedChange={(checked) => toggle(row, checked === true)}
                />
              </Table.Cell>
              <Table.Cell>
                <Link to={orderLink(row)} className="text-ui-fg-interactive">
                  #{row.displayId}
                </Link>
              </Table.Cell>
              <Table.Cell>{row.customer}</Table.Cell>
              <Table.Cell>{orderDateText(row.createdAt)}</Table.Cell>
              <Table.Cell>{deliveryLabel(row)}</Table.Cell>
              <Table.Cell>{parcelsLabel(row.parcels)}</Table.Cell>
              <Table.Cell className="text-right">{zl(row.valueCents)}</Table.Cell>
              <Table.Cell>
                <StateCell row={row} outcome={outcomes[row.orderId]} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!isLoading && !error && rows.length === 0 && (
        <Text className="px-6 py-4 text-ui-fg-subtle">Nie ma zamówień do wysyłki.</Text>
      )}
      {dialog && data && (
        <ShipmentDialog
          kind={dialog}
          rows={dialog === 'create' ? toCreate : toPickup}
          initial={data.defaultPickup}
          onClose={() => setDialog(null)}
          onDone={(results) => finished(dialog, results)}
        />
      )}
    </Container>
  )
}

export const config = defineRouteConfig({ label: 'Do wysyłki', icon: TruckFast })

export default ShippingQueuePage
