import {
  Button,
  Card,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Text } from '@react-email/components'
import type { ShipmentAlertEmailData, ShipmentAlertKind } from './types'

const SUBJECTS: Record<ShipmentAlertKind, (displayId: number | null) => string> = {
  disconnected: () => 'Furgonetka rozłączona – połącz ponownie',
  problem: (id) => (id ? `Problem z przesyłką – zamówienie #${id}` : 'Problem z przesyłką'),
  not_canceled: (id) =>
    id
      ? `Przesyłka nieanulowana w Furgonetce – zamówienie #${id}`
      : 'Przesyłka nieanulowana w Furgonetce',
}

const NEXT_STEP: Record<ShipmentAlertKind, string> = {
  disconnected:
    'Sklep nie może teraz tworzyć przesyłek ani czytać ich statusów. Połącz konto ponownie w panelu Medusy: Settings → Wysyłka → „Połącz z Furgonetką”. Do tego czasu zamówienia możesz realizować ręcznie.',
  problem:
    'Sprawdź przesyłkę w Furgonetce i na karcie Wysyłka w zamówieniu, a w razie potrzeby skontaktuj się z klientem.',
  not_canceled:
    'Realizacja jest anulowana w Medusie, ale paczka w Furgonetce została – anuluj ją w Furgonetce, żeby nie została nadana.',
}

const BUTTON: Record<ShipmentAlertKind, string> = {
  disconnected: 'Otwórz ustawienia wysyłki',
  problem: 'Otwórz zamówienie w panelu',
  not_canceled: 'Otwórz zamówienie w panelu',
}

export function shipmentAlertSubject(data: Pick<ShipmentAlertEmailData, 'kind' | 'displayId'>) {
  return SUBJECTS[data.kind](data.displayId)
}

/** Without a link: where to look in the panel. */
function whereInPanel(data: ShipmentAlertEmailData): string {
  if (data.kind === 'disconnected') return 'Połączysz konto w panelu Medusy (Settings → Wysyłka).'
  return data.displayId
    ? `Zamówienie #${data.displayId} znajdziesz w panelu Medusy (Zamówienia).`
    : 'Zamówienie znajdziesz w panelu Medusy (Zamówienia).'
}

/** Alert for the shop team when a shipment or the Furgonetka connection needs a person (spec 6d §5.11). */
export function ShipmentAlertEmail({
  data,
  ctx,
}: {
  data: ShipmentAlertEmailData
  ctx: RenderContext
}) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  return (
    <EmailLayout
      ctx={ctx}
      preview={shipmentAlertSubject(data)}
      shopUrl={data.shopUrl}
      seller={null}
      reason={`Ten mail wysłał sklep ${ctx.theme.shopName} na adres kontaktowy z Ustawień sklepu.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          {shipmentAlertSubject(data)}
        </Heading>
        <Text style={text}>Komunikat: {data.message}</Text>
        <Text style={text}>{NEXT_STEP[data.kind]}</Text>
        {data.adminUrl ? (
          <Button ctx={ctx} href={data.adminUrl}>
            {BUTTON[data.kind]}
          </Button>
        ) : (
          <Text style={small}>{whereInPanel(data)}</Text>
        )}
      </Card>
    </EmailLayout>
  )
}
