import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminOrder, DetailWidgetProps } from '@medusajs/framework/types'
import {
  Alert,
  Button,
  Container,
  Heading,
  Input,
  Label,
  RadioGroup,
  Select,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useId, useState } from 'react'
import type {
  AdminCreateResponse,
  AdminShipmentResponse,
  AdminShipmentView,
  PickupChoice,
} from '../../lib/card-types'
import type { PickupWindow } from '../../lib/pickup'
import type { CreateResult } from '../../lib/queue-types'
import { CARRIER_NAMES, type Carrier, type ShipmentPlan } from '../../types'
import { errorMessage, sdk } from '../lib/sdk'
import {
  addParcel,
  bulkyHint,
  type CardForm,
  type ChosenTerm,
  cardToast,
  cardWarning,
  changeCarrier,
  draftOf,
  formOf,
  formParcelOf,
  historyLabel,
  pickupLine,
  pickupOf,
  shipmentStateLabel,
  templatesFor,
  termOf,
  termProblem,
} from '../lib/shipment-labels'

const CARRIERS = Object.keys(CARRIER_NAMES) as Carrier[]
/** States of a shipment that exists in Furgonetka, or still holds a package there. */
const DETAIL_STATES = ['ready', 'in_transit', 'delivered', 'problem', 'canceled']
const QUEUE_KEY = ['furgonetka', 'shipping-queue']
const cardKey = (orderId: string) => ['furgonetka', 'shipment', orderId]

type Toast = { kind: 'success' | 'warning' | 'error'; text: string }

/**
 * A request of the card with its toast. Whatever the outcome, the card and the „Do wysyłki” list
 * are read again – the request may have changed the shipment even when it failed.
 */
function useAction<V, D>(
  orderId: string,
  request: (variables: V) => Promise<D>,
  done: (data: D, variables: V) => Toast,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (data, variables) => {
      const { kind, text } = done(data, variables)
      toast[kind](text)
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cardKey(orderId) })
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
    },
  })
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <Label htmlFor={id} size="small" weight="plus">
        {label}
      </Label>
      {children}
    </div>
  )
}

/** The plan of the shipment to edit: carrier, receiver, parcels, value and how it leaves. */
function ShipmentForm({
  orderId,
  card,
  plan,
  term,
  onTerm,
}: {
  orderId: string
  card: AdminShipmentResponse
  plan: ShipmentPlan
  /** The courier window to book; kept by the widget, because this form restarts with the plan. */
  term: PickupWindow
  onTerm: (change: Partial<PickupWindow>) => void
}) {
  const uid = useId()
  const [form, setForm] = useState<CardForm>(() => formOf(plan))
  const set = (change: Partial<CardForm>) => setForm((current) => ({ ...current, ...change }))
  const setParcel = (index: number, change: Partial<CardForm['parcels'][number]>) =>
    setForm((current) => ({
      ...current,
      parcels: current.parcels.map((parcel, at) =>
        at === index ? { ...parcel, ...change } : parcel,
      ),
    }))

  const { actions, order, problems, templates } = card
  const path = `/admin/orders/${orderId}/shipment`
  const locker = form.carrier === 'inpost_locker'
  const failed = card.shipment?.state === 'failed'
  const offered = templatesFor(form.carrier, templates)

  const save = useAction(
    orderId,
    (draft: ShipmentPlan) =>
      sdk.client.fetch<AdminShipmentResponse>(`${path}/draft`, { method: 'POST', body: draft }),
    () => ({ kind: 'success', text: 'Zapisano szkic przesyłki' }),
  )
  const create = useAction(
    orderId,
    (body: { draft: ShipmentPlan; pickup: PickupChoice }) =>
      sdk.client.fetch<AdminCreateResponse>(`${path}/create`, { method: 'POST', body }),
    ({ result }) => cardToast(result, 'create'),
  )
  const restore = useAction<void, AdminShipmentResponse>(
    orderId,
    () => sdk.client.fetch<AdminShipmentResponse>(`${path}/draft`, { method: 'DELETE' }),
    () => ({ kind: 'success', text: 'Przywrócono podpowiedź' }),
  )

  function submit(kind: 'save' | 'create') {
    const read = draftOf(form, plan)
    if ('error' in read) {
      toast.error(read.error)
      return
    }
    if (kind === 'save') {
      save.mutate(read.draft)
      return
    }
    const missing = termProblem(form, term)
    if (missing) {
      toast.error(missing)
      return
    }
    create.mutate({ draft: read.draft, pickup: pickupOf(form, term) })
  }

  const { receiver } = plan
  return (
    <div className="flex flex-col gap-y-4">
      <fieldset disabled={!actions.save} className="m-0 flex min-w-0 flex-col gap-y-4 border-0 p-0">
        <div className="flex flex-col gap-y-2">
          <Text size="small" weight="plus">
            {[receiver.name, receiver.company].filter(Boolean).join(', ')}
          </Text>
          <Field id={`${uid}-phone`} label="Telefon">
            <Input
              id={`${uid}-phone`}
              size="small"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => set({ phone: event.target.value })}
            />
          </Field>
          {locker ? (
            <>
              <Field id={`${uid}-point`} label="Kod paczkomatu">
                <Input
                  id={`${uid}-point`}
                  size="small"
                  value={form.point}
                  onChange={(event) => set({ point: event.target.value })}
                />
              </Field>
              <Field id={`${uid}-point-label`} label="Opis paczkomatu">
                <Input
                  id={`${uid}-point-label`}
                  size="small"
                  value={form.pointLabel}
                  onChange={(event) => set({ pointLabel: event.target.value })}
                />
              </Field>
            </>
          ) : (
            <>
              <Field id={`${uid}-street`} label="Ulica i numer">
                <Input
                  id={`${uid}-street`}
                  size="small"
                  value={form.street}
                  onChange={(event) => set({ street: event.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field id={`${uid}-postal`} label="Kod pocztowy">
                  <Input
                    id={`${uid}-postal`}
                    size="small"
                    value={form.postalCode}
                    onChange={(event) => set({ postalCode: event.target.value })}
                  />
                </Field>
                <Field id={`${uid}-city`} label="Miasto">
                  <Input
                    id={`${uid}-city`}
                    size="small"
                    value={form.city}
                    onChange={(event) => set({ city: event.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
        </div>

        <Field id={`${uid}-carrier`} label="Przewoźnik">
          <Select
            size="small"
            value={form.carrier}
            onValueChange={(carrier) =>
              setForm(changeCarrier(form, carrier as Carrier, templates, order.classPurpose))
            }
          >
            <Select.Trigger id={`${uid}-carrier`}>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {CARRIERS.map((carrier) => (
                <Select.Item
                  key={carrier}
                  value={carrier}
                  disabled={!order.allowedCarriers.includes(carrier)}
                >
                  {CARRIER_NAMES[carrier]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {order.bulky && (
            <Text size="small" className="text-ui-fg-subtle">
              {bulkyHint(order.allowedCarriers)}
            </Text>
          )}
        </Field>

        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            {locker ? 'Gabaryt paczki' : 'Paczki'}
          </Label>
          {form.parcels.map((parcel, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the parcels have no id of their own, the list is only edited in place
              key={index}
              className="border-ui-border-base flex flex-col gap-y-2 rounded-lg border p-3"
            >
              <div className="flex items-center gap-x-2">
                <div className="min-w-0 flex-1">
                  <Select
                    size="small"
                    value={parcel.template_id ?? ''}
                    onValueChange={(id) => {
                      const template = templates.find((candidate) => candidate.id === id)
                      if (template) setParcel(index, formParcelOf(template))
                    }}
                  >
                    <Select.Trigger aria-label={`Szablon paczki ${index + 1}`}>
                      <Select.Value placeholder="Wybierz szablon">{parcel.name}</Select.Value>
                    </Select.Trigger>
                    <Select.Content>
                      {offered.map((template) => (
                        <Select.Item key={template.id} value={template.id}>
                          {template.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                {!locker && form.parcels.length > 1 && (
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() => set({ parcels: form.parcels.filter((_, at) => at !== index) })}
                  >
                    Usuń
                  </Button>
                )}
              </div>
              {locker ? (
                <Text size="small" className="text-ui-fg-subtle">
                  {parcel.length}×{parcel.width}×{parcel.height} cm, {parcel.weight} kg
                </Text>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <Field id={`${uid}-length-${index}`} label="Dł. (cm)">
                    <Input
                      id={`${uid}-length-${index}`}
                      size="small"
                      inputMode="numeric"
                      value={parcel.length}
                      onChange={(event) => setParcel(index, { length: event.target.value })}
                    />
                  </Field>
                  <Field id={`${uid}-width-${index}`} label="Szer. (cm)">
                    <Input
                      id={`${uid}-width-${index}`}
                      size="small"
                      inputMode="numeric"
                      value={parcel.width}
                      onChange={(event) => setParcel(index, { width: event.target.value })}
                    />
                  </Field>
                  <Field id={`${uid}-height-${index}`} label="Wys. (cm)">
                    <Input
                      id={`${uid}-height-${index}`}
                      size="small"
                      inputMode="numeric"
                      value={parcel.height}
                      onChange={(event) => setParcel(index, { height: event.target.value })}
                    />
                  </Field>
                  <Field id={`${uid}-weight-${index}`} label="Waga (kg)">
                    <Input
                      id={`${uid}-weight-${index}`}
                      size="small"
                      inputMode="decimal"
                      value={parcel.weight}
                      onChange={(event) => setParcel(index, { weight: event.target.value })}
                    />
                  </Field>
                </div>
              )}
            </div>
          ))}
          {!locker && (
            <div>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setForm(addParcel(form, templates))}
              >
                + dodaj paczkę
              </Button>
            </div>
          )}
        </div>

        <Field id={`${uid}-value`} label="Wartość deklarowana (zł)">
          <Input
            id={`${uid}-value`}
            size="small"
            inputMode="decimal"
            value={form.value}
            onChange={(event) => set({ value: event.target.value })}
          />
        </Field>

        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            Sposób nadania
          </Label>
          <RadioGroup
            value={form.way}
            onValueChange={(way) => set({ way: way as CardForm['way'] })}
            className="flex flex-col gap-y-2"
          >
            <div className="flex items-center gap-x-3">
              <RadioGroup.Item value="courier" id={`${uid}-courier`} />
              <Label htmlFor={`${uid}-courier`}>Kurier odbierze</Label>
            </div>
            <div className="flex items-center gap-x-3">
              <RadioGroup.Item value="drop_off" id={`${uid}-drop-off`} />
              <Label htmlFor={`${uid}-drop-off`}>Nadam w punkcie/paczkomacie</Label>
            </div>
          </RadioGroup>
          {form.way === 'courier' && (
            <div className="grid grid-cols-3 gap-2">
              <Field id={`${uid}-date`} label="Dzień odbioru">
                <Input
                  id={`${uid}-date`}
                  size="small"
                  type="date"
                  value={term.date}
                  onChange={(event) => onTerm({ date: event.target.value })}
                />
              </Field>
              <Field id={`${uid}-from`} label="Od godziny">
                <Input
                  id={`${uid}-from`}
                  size="small"
                  type="time"
                  value={term.from}
                  onChange={(event) => onTerm({ from: event.target.value })}
                />
              </Field>
              <Field id={`${uid}-to`} label="Do godziny">
                <Input
                  id={`${uid}-to`}
                  size="small"
                  type="time"
                  value={term.to}
                  onChange={(event) => onTerm({ to: event.target.value })}
                />
              </Field>
            </div>
          )}
        </div>
      </fieldset>

      {(problems.length > 0 || (failed && card.shipment?.lastError)) && (
        <div className="flex flex-col gap-y-1">
          {problems.map((problem) => (
            <Text key={problem} size="small" className="text-ui-fg-error">
              {problem}
            </Text>
          ))}
          {failed && card.shipment?.lastError && (
            <Text size="small" className="text-ui-fg-error">
              {card.shipment.lastError}
            </Text>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="secondary"
          disabled={!actions.save}
          isLoading={save.isPending}
          onClick={() => submit('save')}
        >
          Zapisz
        </Button>
        <Button
          size="small"
          disabled={!actions.create}
          isLoading={create.isPending}
          onClick={() => submit('create')}
        >
          {failed ? 'Spróbuj ponownie' : 'Utwórz przesyłkę'}
        </Button>
        {actions.restore && (
          <Button
            size="small"
            variant="transparent"
            isLoading={restore.isPending}
            onClick={() => restore.mutate()}
          >
            Przywróć podpowiedź
          </Button>
        )}
      </div>
    </div>
  )
}

/** A shipment that exists in Furgonetka: its numbers, pickup and history, and what can be done. */
function ShipmentDetails({
  orderId,
  card,
  shipment,
}: {
  orderId: string
  card: AdminShipmentResponse
  shipment: AdminShipmentView
}) {
  const prompt = usePrompt()
  const uid = useId()
  const [term, setTerm] = useState<PickupWindow>(card.defaultPickup)
  const { actions } = card
  const canceled = shipment.state === 'canceled'

  const cancel = useAction<void, { shipment: AdminShipmentView }>(
    orderId,
    () =>
      sdk.client.fetch<{ shipment: AdminShipmentView }>(`/admin/shipments/${shipment.id}/cancel`, {
        method: 'POST',
      }),
    () => ({ kind: 'success', text: 'Anulowano przesyłkę' }),
  )
  const pickup = useAction(
    orderId,
    (window: PickupWindow) =>
      sdk.client.fetch<{ result: CreateResult }>(`/admin/shipments/${shipment.id}/pickup`, {
        method: 'POST',
        body: { pickup: window },
      }),
    ({ result }) => cardToast(result, 'pickup'),
  )
  const simulate = useAction(
    orderId,
    (event: 'picked_up' | 'delivered') =>
      sdk.client.fetch(`/admin/shipments/${shipment.id}/simulate`, {
        method: 'POST',
        body: { event },
      }),
    (_data, event) => ({
      kind: 'success',
      text: event === 'picked_up' ? 'Zasymulowano odbiór' : 'Zasymulowano doręczenie',
    }),
  )

  async function confirmCancel() {
    const confirmed = await prompt({
      title: 'Anulować przesyłkę?',
      description:
        'Paczka zostanie anulowana w Furgonetce, a realizacja w Medusie cofnięta. Zamówienie wróci na listę „Do wysyłki”.',
      confirmText: 'Anuluj przesyłkę',
      cancelText: 'Zostaw',
    })
    if (confirmed) cancel.mutate()
  }

  const termReady = term.date !== '' && term.from !== '' && term.from < term.to
  return (
    <div className="flex flex-col gap-y-2">
      <Text size="small">
        {CARRIER_NAMES[shipment.carrier]} – {shipmentStateLabel(shipment.state)}
      </Text>
      {shipment.tracking.length > 0 && (
        <Text size="small">
          Numer:{' '}
          {shipment.tracking.map((entry, index) => (
            <span key={entry.number}>
              {index > 0 && ', '}
              {entry.url ? (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-fg-interactive"
                >
                  {entry.number}
                </a>
              ) : (
                entry.number
              )}
            </span>
          ))}
        </Text>
      )}
      {!canceled && <Text size="small">Odbiór: {pickupLine(shipment)}</Text>}
      {shipment.lastError && !canceled && (
        <Text size="small" className="text-ui-fg-error">
          {shipment.lastError}
        </Text>
      )}
      {shipment.history.length > 0 && (
        <div className="flex flex-col gap-y-1 pt-1">
          <Text size="small" weight="plus">
            Historia
          </Text>
          {shipment.history.map((entry) => (
            <Text key={`${entry.at}|${entry.status}`} size="small" className="text-ui-fg-subtle">
              {historyLabel(entry)}
            </Text>
          ))}
        </div>
      )}
      {actions.pickup && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Field id={`${uid}-date`} label="Dzień odbioru">
            <Input
              id={`${uid}-date`}
              size="small"
              type="date"
              value={term.date}
              onChange={(event) => setTerm({ ...term, date: event.target.value })}
            />
          </Field>
          <Field id={`${uid}-from`} label="Od godziny">
            <Input
              id={`${uid}-from`}
              size="small"
              type="time"
              value={term.from}
              onChange={(event) => setTerm({ ...term, from: event.target.value })}
            />
          </Field>
          <Field id={`${uid}-to`} label="Do godziny">
            <Input
              id={`${uid}-to`}
              size="small"
              type="time"
              value={term.to}
              onChange={(event) => setTerm({ ...term, to: event.target.value })}
            />
          </Field>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {actions.label && (
          <Button size="small" variant="secondary" asChild>
            <a href={`/admin/shipments/${shipment.id}/label`} target="_blank" rel="noreferrer">
              Drukuj etykietę
            </a>
          </Button>
        )}
        {actions.pickup && (
          <Button
            size="small"
            variant="secondary"
            disabled={!termReady}
            isLoading={pickup.isPending}
            onClick={() => pickup.mutate(term)}
          >
            Zamów odbiór
          </Button>
        )}
        {actions.cancel && (
          <Button
            size="small"
            variant="secondary"
            isLoading={cancel.isPending}
            onClick={confirmCancel}
          >
            Anuluj przesyłkę
          </Button>
        )}
        {card.simulate && !canceled && (
          <>
            <Button
              size="small"
              variant="transparent"
              isLoading={simulate.isPending && simulate.variables === 'picked_up'}
              onClick={() => simulate.mutate('picked_up')}
            >
              Symuluj odbiór
            </Button>
            <Button
              size="small"
              variant="transparent"
              isLoading={simulate.isPending && simulate.variables === 'delivered'}
              onClick={() => simulate.mutate('delivered')}
            >
              Symuluj doręczenie
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/** „Wysyłka” card on the order page (spec 6d §5.5), under the „Faktura” card. */
const OrderShipmentWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { data: card } = useQuery({
    queryKey: cardKey(order.id),
    queryFn: () => sdk.client.fetch<AdminShipmentResponse>(`/admin/orders/${order.id}/shipment`),
  })
  // The pickup window lives here, not in the form below: that one restarts with every new plan.
  const [chosen, setChosen] = useState<ChosenTerm | null>(null)
  if (!card) return null

  const { plan, shipment } = card
  const warning = cardWarning(card)
  const exists = shipment !== null && DETAIL_STATES.includes(shipment.state)
  // An order nothing can be done about (not paid, canceled before shipping) gets no card.
  if (!plan && !exists && !warning) return null
  const term = termOf(chosen, order.id, card.defaultPickup)

  return (
    <Container className="flex flex-col gap-y-4 px-6 py-4">
      <Heading level="h2">Wysyłka</Heading>
      {warning && <Alert variant="warning">{warning}</Alert>}
      {exists && <ShipmentDetails orderId={order.id} card={card} shipment={shipment} />}
      {/* A new key when the plan changes on the server: the form starts from the plan again. */}
      {plan && (
        <ShipmentForm
          key={JSON.stringify(plan)}
          orderId={order.id}
          card={card}
          plan={plan}
          term={term}
          onTerm={(change) => setChosen({ orderId: order.id, term: { ...term, ...change } })}
        />
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: 'order.details.side.before' })

export default OrderShipmentWidget
