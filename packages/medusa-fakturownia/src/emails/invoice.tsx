import { formatPrice } from '@cloud-house/commerce-rules'
import {
  Button,
  Card,
  ContactCard,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Text } from '@react-email/components'
import type { InvoiceEmailData } from '../types'

export function invoiceSubject(data: Pick<InvoiceEmailData, 'displayId'>): string {
  return `Faktura do zamówienia nr ${data.displayId}`
}

/** „Faktura do zamówienia” with the PDF attached (spec 6c §5.5). */
export function InvoiceEmail({ data, ctx }: { data: InvoiceEmailData; ctx: RenderContext }) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  return (
    <EmailLayout
      ctx={ctx}
      preview={`Faktura ${data.number} do zamówienia #${data.displayId} w załączniku.`}
      shopUrl={data.shopUrl}
      seller={data.seller}
      reason={`Ten mail wysłaliśmy, bo w sklepie ${ctx.theme.shopName} złożono zamówienie z tym adresem e-mail.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          Twoja faktura
        </Heading>
        <Text style={text}>
          Dziękujemy za zakupy w {ctx.theme.shopNameLocative}. Wystawiliśmy fakturę{' '}
          <strong>{data.number}</strong> do zamówienia <strong>#{data.displayId}</strong> na kwotę{' '}
          {formatPrice(data.total)}.
        </Text>
        <Text style={text}>Fakturę znajdziesz w załączniku (PDF).</Text>
        {data.accountUrl && (
          <>
            <Button ctx={ctx} href={data.accountUrl}>
              Zobacz zamówienie w koncie
            </Button>
            <Text style={small}>Fakturę możesz też pobrać w szczegółach zamówienia w koncie.</Text>
          </>
        )}
      </Card>
      <ContactCard ctx={ctx} contact={data.contact} />
    </EmailLayout>
  )
}
