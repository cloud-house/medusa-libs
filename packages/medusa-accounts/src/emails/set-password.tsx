import {
  Button,
  Card,
  ContactCard,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Link, Text } from '@react-email/components'
import { greeting } from './email-confirmation'
import type { AccountEmailData } from './types'

export const setPasswordSubject = (ctx: Pick<RenderContext, 'theme'>) =>
  `Ustaw hasło do konta ${ctx.theme.shopName}`

/** „Ustaw hasło” for an account created in the checkout (spec 5a part 2 §5.2) – link valid 7 days. */
export function SetPasswordEmail({ data, ctx }: { data: AccountEmailData; ctx: RenderContext }) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  const { muted } = ctx.theme.colors
  return (
    <EmailLayout
      ctx={ctx}
      preview={`Ustaw hasło do konta ${ctx.theme.shopName}, żeby sprawdzać status zamówienia.`}
      shopUrl={data.shopUrl}
      seller={data.seller}
      reason={`Ten mail wysłaliśmy, bo przy zamówieniu w sklepie ${ctx.theme.shopName} zaznaczono „Chcę założyć konto w sklepie” z tym adresem e-mail.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          Ustaw hasło
        </Heading>
        <Text style={text}>{greeting(data.firstName)}</Text>
        <Text style={text}>
          {data.orderNumber
            ? `Zamówienie #${data.orderNumber} jest już w Twoim koncie. Ustaw hasło, żeby się logować i sprawdzać status.`
            : `Twoje konto w ${ctx.theme.shopNameLocative} czeka na hasło.`}
        </Text>
        <Button ctx={ctx} href={data.actionUrl}>
          Ustaw hasło
        </Button>
        <Text style={small}>Link jest ważny 7 dni. Jeśli to nie Ty, zignoruj tę wiadomość.</Text>
        <Text style={small}>
          Jeśli przycisk nie działa, skopiuj ten adres do przeglądarki:{' '}
          <Link href={data.actionUrl} style={{ color: muted, wordBreak: 'break-all' }}>
            {data.actionUrl}
          </Link>
        </Text>
      </Card>
      <ContactCard ctx={ctx} contact={data.contact} />
    </EmailLayout>
  )
}
