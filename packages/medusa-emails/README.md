# @cloud-house/medusa-emails

Medusa 2 plugin: transactional e-mails for a shop. The shop supplies the templates and the theme;
the plugin brings the options, the localised layout texts, the themed layout components, the
renderer, the Resend notification provider, a send workflow and a preview helper.

```sh
pnpm add --save-exact @cloud-house/medusa-emails
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README).

## Options

```ts
import { resolveOptions, type EmailsOptions } from '@cloud-house/medusa-emails'

const options: EmailsOptions = {
  theme: { shopName: 'Acme', shopNameLocative: 'Acme' }, // `shopName` is required
  locale: 'pl', // 'pl' | 'en', default 'pl'
  messages: { sellerLine: 'Sprzedawca: {seller}' }, // single texts over the dictionary
  templates: [welcomeTemplate], // names must be unique
  apiKey: process.env.RESEND_API_KEY,
  from: 'Acme <shop@example.com>',
  replyTo: 'shop@example.com',
  mode: 'send', // 'send' | 'preview' (render to `previewDir` only)
  previewDir: '.email-previews',
  channels: ['sc_123'],
}
```

`resolveOptions` fills in the defaults, treats `undefined` values as unset and throws when
`theme.shopName` is missing, `locale` is unknown or two templates share a name.

## Theme

| Field | Default |
|---|---|
| `shopName` | required |
| `shopNameLocative` | `shopName` ("w {shopNameLocative}" in Polish) |
| `logoUrl` | `null` |
| `colors.navy` | `#1f2933` (header, main text) |
| `colors.sand` | `#f4f4f1` (page background) |
| `colors.muted` | `#52606d` |
| `colors.subtle` | `#7b8794` |
| `colors.line` | `#d9d9d3` |
| `colors.success` | `#2f7a46` |
| `colors.yellow` | `#f0c93a` (buttons) |
| `fonts.sans`, `fonts.display` | `Arial, Helvetica, sans-serif` |
| `footerLinks` | `[]` (`{ label, url }[]`) |

Colours are hex: e-mail clients ignore oklch and CSS variables.

## Dictionaries

`messages.pl` and `messages.en` hold the layout texts and the shared phrases (reply to this e-mail,
seller line, footer links). `{shopName}` and `{shopNameLocative}` are filled in from the theme;
`{seller}`, `{contact}`, `{email}`, `{phone}`, `{hours}` are filled in by the layout helpers.

## Templates

An `EmailTemplate` is `{ name, render(data, ctx) }`; `render` returns `{ subject, html, text, name }`
and gets the resolved theme, messages and locale in `ctx`.

## Provider

Register the provider in the Notification module (`medusa-config.ts`). It keeps the id `resend` and
serves the channels in `channels`; `emailEnv` reads `RESEND_API_KEY`, `EMAIL_FROM`,
`EMAIL_REPLY_TO`, `EMAIL_PREVIEW_DIR` and `NODE_ENV`.

```ts
import { emailEnv, type EmailsOptions } from '@cloud-house/medusa-emails'

const emails: EmailsOptions = {
  channels: ['email'],
  ...emailEnv(process.env),
  theme: { shopName: 'Acme' },
  templates: [welcomeTemplate],
}

modules: [
  {
    resolve: '@medusajs/medusa/notification',
    options: {
      providers: [
        { resolve: '@cloud-house/medusa-emails/providers/resend', id: 'resend', options: emails },
      ],
    },
  },
]
```

Mails go out through Resend only with a key and a sender. Otherwise the HTML (and attachments) is
written to `previewDir` and logged; without `previewDir` (production) the notification fails with
`emails_not_sent`. A notification's `idempotency_key` is passed to Resend and `provider_data.reply_to`
overrides the default Reply-To. `emailWarnings(process.env, 'Acme')` returns startup warnings for a
missing key or sender.

## Sending

`@cloud-house/medusa-emails/workflows/send-email` exports `sendEmailWorkflow` (`send-email`); input:
`{ template, to, data, replyTo, idempotencyKey, resourceType, resourceId, trigger }`.

## Custom template

```tsx
import { render, Text } from '@react-email/components'
import { Button, Card, EmailLayout, type EmailTemplate } from '@cloud-house/medusa-emails'

export const welcome: EmailTemplate = {
  name: 'welcome',
  async render(data, ctx) {
    const element = (
      <EmailLayout
        ctx={ctx}
        preview="Welcome"
        shopUrl="https://shop.example.com"
        reason="You got this e-mail because you created an account."
      >
        <Card ctx={ctx} title="Welcome">
          <Text>Hello {String(data.firstName)}</Text>
          <Button ctx={ctx} href="https://shop.example.com">Visit the shop</Button>
        </Card>
      </EmailLayout>
    )
    return {
      subject: 'Welcome',
      html: await render(element),
      text: await render(element, { plainText: true }),
      name: `welcome-${data.email}`, // preview file name
    }
  },
}
```

`EmailLayout` takes `ctx`, `preview`, optional `shopUrl` (linked after the shop name in the footer),
`seller` (filled into `messages.sellerLine`) and `reason` (last footer line). The header shows
`theme.logoUrl` or the shop name; the footer links come from `theme.footerLinks`. `ContactCard`
and `contactSentence` build the "Questions?" card from the dictionary; `layoutStyles(theme)` gives
the shared inline styles (`text`, `small`, `card`, `cardTitle`, `pageTitle`); `Row` and `Column`
are re-exported from React Email. `theme.fonts.stylesheet` links a web-font stylesheet in the `<head>`.

## Preview

`previewEmails(options, fixtures)` renders `{ template, data }` fixtures to `options.previewDir`
and returns the file paths. The plugin ships no demo data – call it from a `medusa exec` script:

```ts
import { previewEmails } from '@cloud-house/medusa-emails'

await previewEmails({ ...emails, previewDir: '.emails' }, [
  { template: 'welcome', data: { firstName: 'Ola', email: 'ola@example.com' } },
])
```

## Error codes

`EMAIL_ERROR_CODES`: `emails_unknown_template`, `emails_not_sent`. Renaming one is a breaking change
(minor bump in 0.x).
