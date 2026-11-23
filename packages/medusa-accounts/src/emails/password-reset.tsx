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

export const passwordResetSubject = (ctx: Pick<RenderContext, 'theme'>) =>
  `Ustaw nowe hasło w ${ctx.theme.shopNameLocative}`

/** „Nie pamiętasz hasła?” – Medusa's reset token lives 15 minutes (spec 5a §3.9). */
export function PasswordResetEmail({ data, ctx }: { data: AccountEmailData; ctx: RenderContext }) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  const { muted } = ctx.theme.colors
  return (
    <EmailLayout
      ctx={ctx}
      preview={`Link do ustawienia nowego hasła w ${ctx.theme.shopNameLocative}.`}
      shopUrl={data.shopUrl}
      seller={data.seller}
      reason={`Ten mail wysłaliśmy, bo ktoś poprosił o nowe hasło do konta ${ctx.theme.shopName} z tym adresem e-mail.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          Ustaw nowe hasło
        </Heading>
        <Text style={text}>{greeting(data.firstName)}</Text>
        <Text style={text}>
          Dostaliśmy prośbę o nowe hasło do Twojego konta. Kliknij przycisk i wpisz nowe hasło.
        </Text>
        <Button ctx={ctx} href={data.actionUrl}>
          Ustaw nowe hasło
        </Button>
        <Text style={small}>Link jest ważny 15 minut. Jeśli to nie Ty, zignoruj tę wiadomość.</Text>
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
