# @cloud-house/medusa-emails

Medusa 2 plugin: transactional e-mails for a shop. The shop supplies the templates and the theme;
the plugin brings the options, the localised layout texts and (in the next release) the Resend
notification provider, renderer and layout components.

This release contains the options, the theme, the PL/EN dictionaries, the types and the error codes.

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

## Error codes

`EMAIL_ERROR_CODES`: `emails_unknown_template`, `emails_not_sent`. Renaming one is a breaking change
(minor bump in 0.x).
