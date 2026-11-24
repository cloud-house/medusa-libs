import {
  Button,
  Card,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Text } from '@react-email/components'
import { returnLineLabel } from './return-requested'
import type { ReturnAlertEmailData } from './types'

export function returnAlertSubject(data: Pick<ReturnAlertEmailData, 'displayId'>): string {
  return `Nowy zwrot – zamówienie #${data.displayId}`
}

/** Alert for the shop team about a new return request (spec 6e-b §5.5). */
export function ReturnAlertEmail({
  data,
  ctx,
}: {
  data: ReturnAlertEmailData
  ctx: RenderContext
}) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  return (
    <EmailLayout
      ctx={ctx}
      preview={returnAlertSubject(data)}
      shopUrl={data.shopUrl}
      seller={null}
      reason={`Ten mail wysłał sklep ${ctx.theme.shopName} na adres kontaktowy z Ustawień sklepu.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          {returnAlertSubject(data)}
        </Heading>
        <Text style={text}>
          {`Klient zgłosił zwrot nr ${data.returnNumber} do zamówienia #${data.displayId}${data.email ? ` (${data.email})` : ''}.`}
        </Text>
        {data.items.map((line) => {
          const label = `${returnLineLabel(line)}${line.reason ? ` – ${line.reason}` : ''}`
          return (
            <Text key={label} style={{ ...text, margin: '0 0 4px' }}>
              {label}
            </Text>
          )
        })}
        {data.note && (
          // The note is typed in a text area – its line breaks stay.
          <Text style={{ ...text, marginTop: 12, whiteSpace: 'pre-line' }}>
            Uwagi klienta: {data.note}
          </Text>
        )}
        <Text style={text}>
          Gdy paczka dotrze, przyjmij zwrot w zamówieniu w panelu Medusy
          {data.afterReceiveHint ? ` – ${data.afterReceiveHint}` : ''}. Pieniądze zwróć ręcznie w
          płatnościach zamówienia (Refund).
        </Text>
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
