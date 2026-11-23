import {
  Button,
  Card,
  ContactCard,
  EmailLayout,
  layoutStyles,
  type RenderContext,
} from '@cloud-house/medusa-emails'
import { Heading, Link, Text } from '@react-email/components'
import type { AccountEmailData } from './types'

export const emailConfirmationSubject = (ctx: Pick<RenderContext, 'theme'>) =>
  `Potwierdź adres e-mail w ${ctx.theme.shopNameLocative}`

export const greeting = (firstName: string | null) =>
  firstName ? `Cześć, ${firstName}!` : 'Cześć!'

/** „Potwierdź adres e-mail” after registration (spec 5a §6) – the link is valid for 7 days. */
export function EmailConfirmationEmail({
  data,
  ctx,
}: {
  data: AccountEmailData
  ctx: RenderContext
}) {
  const { pageTitle, small, text } = layoutStyles(ctx.theme)
  const { muted } = ctx.theme.colors
  return (
    <EmailLayout
      ctx={ctx}
      preview="Potwierdź adres e-mail, żeby zobaczyć w koncie wszystkie swoje zamówienia."
      shopUrl={data.shopUrl}
      seller={data.seller}
      reason={`Ten mail wysłaliśmy, bo w sklepie ${ctx.theme.shopName} założono konto z tym adresem e-mail. Jeśli to nie Ty, zignoruj tę wiadomość.`}
    >
      <Card ctx={ctx}>
        <Heading as="h1" style={pageTitle}>
          Potwierdź adres e-mail
        </Heading>
        <Text style={text}>{greeting(data.firstName)}</Text>
        <Text style={text}>
          {`Dziękujemy za założenie konta w ${ctx.theme.shopNameLocative}. Potwierdź adres e-mail – wtedy w koncie zobaczysz też zamówienia złożone wcześniej bez konta na ten adres.`}
        </Text>
        <Button ctx={ctx} href={data.actionUrl}>
          Potwierdź e-mail
        </Button>
        <Text style={small}>Link jest ważny 7 dni.</Text>
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
