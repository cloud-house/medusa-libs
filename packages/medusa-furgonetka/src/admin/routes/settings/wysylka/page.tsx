import { defineRouteConfig } from '@medusajs/admin-sdk'
import { ArchiveBox } from '@medusajs/icons'
import {
  Alert,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { TemplateKind, TemplatePurpose } from '../../../../types'
import { errorMessage, sdk } from '../../../lib/sdk'
import {
  connectionText,
  dimensionsText,
  type FurgonetkaView,
  gramsFromKg,
  KIND_LABELS,
  kgText,
  numberFromText,
  type ParcelClassView,
  type ParcelTemplateView,
  purposeOptions,
  purposeText,
  weightText,
} from '../../../lib/shipping-labels'

const FURGONETKA_KEY = ['furgonetka', 'furgonetka']
const TEMPLATES_KEY = ['furgonetka', 'parcel-templates']

const KINDS = Object.keys(KIND_LABELS) as TemplateKind[]
/** `Select` items cannot have an empty value, so „no purpose” gets one of its own. */
const NO_PURPOSE = 'none'

/** The outcome the callback put in the address: `?furgonetka=ok|error`. */
function outcomeFromAddress(): 'ok' | 'error' | null {
  const value = new URLSearchParams(window.location.search).get('furgonetka')
  return value === 'ok' || value === 'error' ? value : null
}

/** The shop's parcel classes (from the connection answer, which the page reads anyway). */
function useParcelClasses(): ParcelClassView[] {
  const { data } = useQuery({
    queryKey: FURGONETKA_KEY,
    queryFn: () => sdk.client.fetch<FurgonetkaView>('/admin/furgonetka'),
  })
  return data?.parcelClasses ?? []
}

const FurgonetkaSection = () => {
  const queryClient = useQueryClient()
  const [outcome] = useState(outcomeFromAddress)
  const { data } = useQuery({
    queryKey: FURGONETKA_KEY,
    queryFn: () => sdk.client.fetch<FurgonetkaView>('/admin/furgonetka'),
  })
  const connect = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ url: string | null }>('/admin/furgonetka/connect', { method: 'POST' }),
    onSuccess: ({ url }) => {
      // The real account logs in on Furgonetka's page and comes back to the callback. The fake
      // is connected already, so the page only reloads the state.
      if (url) {
        window.location.assign(url)
        return
      }
      toast.success('Połączono z Furgonetką')
      queryClient.invalidateQueries({ queryKey: FURGONETKA_KEY })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Furgonetka</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Konto, z którego sklep nadaje przesyłki DPD i InPost.
          </Text>
        </div>
        <Button
          size="small"
          variant={data?.state === 'connected' ? 'secondary' : 'primary'}
          disabled={!data?.canConnect}
          isLoading={connect.isPending}
          onClick={() => connect.mutate()}
        >
          Połącz z Furgonetką
        </Button>
      </div>
      <div className="flex flex-col gap-2 px-6 py-4">
        {outcome === 'ok' && <Alert variant="success">Połączono z Furgonetką.</Alert>}
        {outcome === 'error' && (
          <Alert variant="error">Nie udało się połączyć z Furgonetką – spróbuj ponownie.</Alert>
        )}
        {data && <Text>Stan: {connectionText(data)}</Text>}
        {data?.reason && (
          <Text size="small" className="text-ui-fg-subtle">
            {data.reason}
          </Text>
        )}
      </div>
    </Container>
  )
}

type Form = {
  name: string
  kind: TemplateKind
  length: string
  width: string
  height: string
  weight: string
  purpose: TemplatePurpose | typeof NO_PURPOSE
}

const EMPTY_FORM: Form = {
  name: '',
  kind: 'box',
  length: '',
  width: '',
  height: '',
  weight: '',
  purpose: NO_PURPOSE,
}

function formOf(template: ParcelTemplateView | 'new' | null): Form {
  if (!template || template === 'new') return EMPTY_FORM
  return {
    name: template.name,
    kind: template.kind,
    length: String(template.length_cm),
    width: String(template.width_cm),
    height: String(template.height_cm),
    weight: kgText(template.weight_g),
    purpose: template.purpose ?? NO_PURPOSE,
  }
}

function TemplateDrawer({
  template,
  onClose,
}: {
  template: ParcelTemplateView | 'new' | null
  onClose: () => void
}) {
  const classes = useParcelClasses()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const set = (change: Partial<Form>) => setForm((current) => ({ ...current, ...change }))

  useEffect(() => {
    setForm(formOf(template))
  }, [template])

  const save = useMutation({
    mutationFn: () => {
      // Anything that is not a number goes as `null`; the server answers with its own message.
      const body = {
        name: form.name,
        kind: form.kind,
        length_cm: numberFromText(form.length),
        width_cm: numberFromText(form.width),
        height_cm: numberFromText(form.height),
        weight_g: gramsFromKg(form.weight),
        purpose: form.purpose === NO_PURPOSE ? null : form.purpose,
      }
      const path =
        template && template !== 'new'
          ? `/admin/parcel-templates/${template.id}`
          : '/admin/parcel-templates'
      return sdk.client.fetch(path, { method: 'POST', body })
    },
    onSuccess: () => {
      toast.success('Zapisano szablon')
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
      onClose()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Drawer open={template !== null} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{template === 'new' ? 'Nowy szablon' : 'Edytuj szablon'}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Nazwa</Label>
            <Input
              id="template-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-kind">Rodzaj</Label>
            <Select value={form.kind} onValueChange={(kind) => set({ kind: kind as TemplateKind })}>
              <Select.Trigger id="template-kind">
                <Select.Value placeholder="Wybierz rodzaj" />
              </Select.Trigger>
              <Select.Content>
                {KINDS.map((kind) => (
                  <Select.Item key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Wymiary (cm)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                aria-label="Długość (cm)"
                placeholder="Długość"
                inputMode="numeric"
                value={form.length}
                onChange={(e) => set({ length: e.target.value })}
              />
              <Input
                aria-label="Szerokość (cm)"
                placeholder="Szerokość"
                inputMode="numeric"
                value={form.width}
                onChange={(e) => set({ width: e.target.value })}
              />
              <Input
                aria-label="Wysokość (cm)"
                placeholder="Wysokość"
                inputMode="numeric"
                value={form.height}
                onChange={(e) => set({ height: e.target.value })}
              />
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Pełne centymetry, od 1 do 300.
            </Text>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-weight">Waga (kg)</Label>
            <Input
              id="template-weight"
              inputMode="decimal"
              placeholder="np. 2,5"
              value={form.weight}
              onChange={(e) => set({ weight: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-purpose">Domyślne przeznaczenie</Label>
            <Select
              value={form.purpose}
              onValueChange={(purpose) => set({ purpose: purpose as Form['purpose'] })}
            >
              <Select.Trigger id="template-purpose">
                <Select.Value placeholder="Wybierz przeznaczenie" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={NO_PURPOSE}>Brak</Select.Item>
                {purposeOptions(classes).map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Text size="small" className="text-ui-fg-subtle">
              Najwyżej jeden szablon na przeznaczenie – wybrane przeznaczenie traci poprzedni
              szablon. Szablonu z przeznaczeniem nie usuniesz, dopóki nie przypiszesz go innemu.
            </Text>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Anuluj</Button>
          </Drawer.Close>
          <Button onClick={() => save.mutate()} isLoading={save.isPending}>
            Zapisz
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

const TemplatesSection = () => {
  const classes = useParcelClasses()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [editing, setEditing] = useState<ParcelTemplateView | 'new' | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => sdk.client.fetch<{ templates: ParcelTemplateView[] }>('/admin/parcel-templates'),
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/parcel-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Usunięto szablon')
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const confirmDelete = async (template: ParcelTemplateView) => {
    const confirmed = await prompt({
      title: `Usunąć szablon ${template.name}?`,
      description: 'Szablon zniknie z listy. Przesyłki, które już powstały, zostają bez zmian.',
      confirmText: 'Usuń',
      cancelText: 'Anuluj',
    })
    if (confirmed) remove.mutate(template.id)
  }

  const templates = data?.templates ?? []
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Szablony paczek</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Gabaryty i waga kartonów oraz paczkomatów. Z szablonów sklep układa podpowiedź paczek do
            zamówienia.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setEditing('new')}>
          Dodaj szablon
        </Button>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Nazwa</Table.HeaderCell>
            <Table.HeaderCell>Rodzaj</Table.HeaderCell>
            <Table.HeaderCell>Wymiary</Table.HeaderCell>
            <Table.HeaderCell>Waga</Table.HeaderCell>
            <Table.HeaderCell>Przeznaczenie</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {templates.map((template) => (
            <Table.Row key={template.id}>
              <Table.Cell>{template.name}</Table.Cell>
              <Table.Cell>{KIND_LABELS[template.kind]}</Table.Cell>
              <Table.Cell>{dimensionsText(template)}</Table.Cell>
              <Table.Cell>{weightText(template.weight_g)}</Table.Cell>
              <Table.Cell>{purposeText(template.purpose, classes)}</Table.Cell>
              <Table.Cell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="small" variant="transparent" onClick={() => setEditing(template)}>
                    Edytuj
                  </Button>
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() => confirmDelete(template)}
                  >
                    Usuń
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!isLoading && templates.length === 0 && (
        <Text className="px-6 py-4 text-ui-fg-subtle">Nie ma jeszcze żadnego szablonu.</Text>
      )}
      <TemplateDrawer template={editing} onClose={() => setEditing(null)} />
    </Container>
  )
}

/** Settings → Wysyłka: the Furgonetka connection and the parcel templates (spec 6d §5.3, §5.11). */
const ShippingSettingsPage = () => (
  <div className="flex flex-col gap-4">
    <FurgonetkaSection />
    <TemplatesSection />
  </div>
)

export const config = defineRouteConfig({ label: 'Wysyłka', icon: ArchiveBox })

export default ShippingSettingsPage
