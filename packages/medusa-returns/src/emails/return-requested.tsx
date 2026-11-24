import {
  Button,
  Card,
  ContactCard,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Text } from '@react-email/components'
import type { ReturnEmailLine, ReturnRequestedEmailData } from './types'

export function returnRequestedSubject(data: Pick<ReturnRequestedEmailData, 'displayId'>): string {
  return `Zgłoszenie zwrotu do zamówienia #${data.displayId}`
}

/** „Produkt – wariant × 2”; without a variant „Produkt × 2”. */
export function returnLineLabel(line: Pick<ReturnEmailLine, 'name' | 'variant' | 'quantity'>) {
  return `${line.name}${line.variant ? ` – ${line.variant}` : ''} × ${line.quantity}`
}

/**
 * „Mamy Twoje zgłoszenie zwrotu” (spec 6e-b §5.5): what the customer returns, how to send it back
 * and when the money comes back.
 */
export function ReturnRequestedEmail({
  data,
  ctx,
}: {
  data: ReturnRequestedEmailData
  ctx: RenderContext
}) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  return (
    <EmailLayout
      ctx={ctx}
      preview={`Mamy Twoje zgłoszenie zwrotu do zamówienia #${data.displayId} – tak odeślesz towar.`}
      shopUrl={data.shopUrl}
      seller={data.seller}
      reason={`Ten mail wysłaliśmy, bo w sklepie ${ctx.theme.shopName} zgłoszono zwrot do zamówienia z tym adresem e-mail.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          Mamy Twoje zgłoszenie zwrotu
        </Heading>
        <Text style={text}>
          Otrzymaliśmy Twoje oświadczenie o odstąpieniu od umowy dla zamówienia nr{' '}
          <strong>{data.displayId}</strong> (zgłoszenie nr {data.returnNumber}).
        </Text>
      </Card>

      <Card ctx={ctx} title="Co zwracasz">
        {data.items.map((line) => (
          <Text key={returnLineLabel(line)} style={{ ...text, margin: '0 0 4px' }}>
            {returnLineLabel(line)}
          </Text>
        ))}
      </Card>

      <Card ctx={ctx} title="Jak odesłać towar">
        {data.address ? (
          <>
            <Text style={text}>Odeślij towar w ciągu 14 dni od zgłoszenia na adres:</Text>
            {data.address.map((line) => (
              <Text key={line} style={{ ...text, fontWeight: 700, margin: 0 }}>
                {line}
              </Text>
            ))}
            {/* Bez adresu strona etykiety odpowiada tylko „napisz do nas” – przycisku nie ma. */}
            <Button ctx={ctx} href={data.labelUrl}>
              Wydrukuj etykietę adresową
            </Button>
          </>
        ) : (
          <Text style={text}>Napisz do nas przed wysłaniem paczki – podamy adres do zwrotu.</Text>
        )}
        <Text style={text}>
          Bezpośredni koszt odesłania Towaru ponosi Kupujący.
          {data.shippingHint ? ` ${data.shippingHint}` : ''}
        </Text>
        {data.packingHint && <Text style={small}>{data.packingHint}</Text>}
      </Card>

      <Card ctx={ctx} title="Zwrot pieniędzy">
        <Text style={text}>
          Pieniądze oddamy niezwłocznie, nie później niż w ciągu 14 dni od otrzymania Twojego
          oświadczenia, tą samą metodą płatności. Możemy wstrzymać zwrot do czasu otrzymania towaru
          albo dowodu jego odesłania.
        </Text>
        <Text style={small}>
          Przy zwrocie całego zamówienia oddamy też koszt dostawy do Ciebie.
        </Text>
      </Card>

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
