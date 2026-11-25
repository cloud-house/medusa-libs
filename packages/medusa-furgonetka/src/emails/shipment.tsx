import {
  Button,
  Card,
  ContactCard,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Link, Text } from '@react-email/components'
import type { ShipmentEmailData } from './types'

export function shipmentSubject(data: Pick<ShipmentEmailData, 'displayId'>): string {
  return `Zamówienie nr ${data.displayId} jest w drodze`
}

/** „Paczka w drodze” (spec 6d §5.8): carrier, tracking, destination and contents of the parcel. */
export function ShipmentEmail({ data, ctx }: { data: ShipmentEmailData; ctx: RenderContext }) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  const { muted } = ctx.theme.colors
  return (
    <EmailLayout
      ctx={ctx}
      preview={`Twoje zamówienie nr ${data.displayId} jest już u przewoźnika: ${data.carrier}.`}
      shopUrl={data.shopUrl}
      seller={null}
      reason={`Ten mail wysłaliśmy, bo w sklepie ${ctx.theme.shopName} złożono zamówienie z tym adresem e-mail.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          Paczka w drodze
        </Heading>
        <Text style={text}>
          Twoje zamówienie nr <strong>{data.displayId}</strong> jest już u przewoźnika:{' '}
          {data.carrier}.
        </Text>
      </Card>

      {data.parcels.length > 0 && (
        <Card ctx={ctx} title="Śledzenie przesyłki">
          {data.parcels.map((parcel) => (
            <Text key={parcel.number} style={{ ...text, margin: '0 0 4px' }}>
              {parcel.url ? (
                <Link href={parcel.url} style={{ color: muted, textDecoration: 'underline' }}>
                  {parcel.number}
                </Link>
              ) : (
                parcel.number
              )}
            </Text>
          ))}
        </Card>
      )}

      {data.destination && (
        <Card ctx={ctx} title="Dokąd jedzie paczka">
          <Text style={{ ...text, fontWeight: 700, margin: 0 }}>{data.destination.title}</Text>
          {data.destination.lines.map((line) => (
            <Text key={line} style={small}>
              {line}
            </Text>
          ))}
        </Card>
      )}

      {data.items.length > 0 && (
        <Card ctx={ctx} title="Co jest w paczce">
          {data.items.map((item) => (
            <Text key={item.name} style={{ ...text, margin: '0 0 4px' }}>
              {item.name} × {item.quantity}
            </Text>
          ))}
        </Card>
      )}

      {data.accountUrl && (
        <Card ctx={ctx}>
          <Button ctx={ctx} href={data.accountUrl}>
            Zobacz zamówienie w koncie
          </Button>
        </Card>
      )}

      {data.contact && <ContactCard ctx={ctx} contact={data.contact} />}
    </EmailLayout>
  )
}
