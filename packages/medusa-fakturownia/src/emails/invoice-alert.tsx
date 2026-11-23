import {
  Button,
  Card,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Text } from '@react-email/components'
import type { InvoiceAlertEmailData, InvoiceAlertKind } from '../types'

const SUBJECTS: Record<InvoiceAlertKind, (displayId: number) => string> = {
  issue: (id) => `Faktura nie powstała – zamówienie #${id}`,
  total: (id) => `Faktura do sprawdzenia – zamówienie #${id}`,
  ksef: (id) => `Błąd KSeF – faktura do zamówienia #${id}`,
  email: (id) => `Faktura nie wyszła e-mailem – zamówienie #${id}`,
  correction: (id) => `Korekta faktury nie powstała – zamówienie #${id}`,
}

const NEXT_STEP: Record<InvoiceAlertKind, string> = {
  issue:
    'Sklep ponawiał próby. Sprawdź komunikat, popraw dane w Fakturowni albo w zamówieniu i kliknij „Wystaw ponownie” na karcie Faktura w panelu Medusy.',
  total: 'Popraw fakturę w Fakturowni i kliknij „Sprawdź ponownie” na karcie Faktura.',
  ksef: 'Sprawdź fakturę w Fakturowni i wyślij ją do KSeF jeszcze raz. Gdy KSeF nada numer, sklep sam wyśle fakturę klientowi.',
  email: 'Sklep ponawiał wysyłkę. Na karcie Faktura w panelu Medusy możesz wysłać maila ponownie.',
  correction:
    'Sprawdź zwrot w zamówieniu w panelu Medusy i fakturę w Fakturowni. Sklep ponawia, gdy to ma sens; gdy korekta nie powstanie, wystaw ją ręcznie w Fakturowni.',
}

export function invoiceAlertSubject(data: Pick<InvoiceAlertEmailData, 'kind' | 'displayId'>) {
  return SUBJECTS[data.kind](data.displayId)
}

/** Alert for the shop team when an invoice or a credit note needs a person (spec 6c §5.6). */
export function InvoiceAlertEmail({
  data,
  ctx,
}: {
  data: InvoiceAlertEmailData
  ctx: RenderContext
}) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  return (
    <EmailLayout
      ctx={ctx}
      preview={invoiceAlertSubject(data)}
      shopUrl={data.shopUrl}
      seller={null}
      reason={`Ten mail wysłał sklep ${ctx.theme.shopName} na adres kontaktowy z Ustawień sklepu.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          {invoiceAlertSubject(data)}
        </Heading>
        <Text style={text}>Komunikat: {data.message}</Text>
        <Text style={text}>{NEXT_STEP[data.kind]}</Text>
        {data.adminUrl ? (
          <Button ctx={ctx} href={data.adminUrl}>
            Otwórz zamówienie w panelu
          </Button>
        ) : (
          <Text style={small}>
            Zamówienie #{data.displayId} znajdziesz w panelu Medusy (Zamówienia).
          </Text>
        )}
      </Card>
    </EmailLayout>
  )
}
