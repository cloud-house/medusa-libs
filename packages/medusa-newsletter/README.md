# @cloud-house/medusa-newsletter

Medusa 2 plugin: newsletter sign-ups with proof of consent. Only the storefront's server can write
them (shared secret); the admin gets a list with search, a CSV export and a GDPR delete.

```sh
pnpm add --save-exact @cloud-house/medusa-newsletter@0.1.0
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README).

## Setup

```ts
// medusa-config.ts
plugins: [
  {
    resolve: '@cloud-house/medusa-newsletter',
    options: {
      locale: 'pl', // 'pl' | 'en', default 'pl'
      messages: { alreadySubscribed: '…' }, // single texts over the dictionary
      storefrontSecret: { header: 'x-storefront-secret', env: 'STOREFRONT_API_SECRET' },
      sources: ['footer', 'home', 'register', 'checkout'], // accepted `source` values
    },
  },
],
```

Then `medusa db:migrate` (module `newsletter`, table `newsletter_subscriber`). Do not also list the
module under `modules`: an entry there replaces the plugin's module and its options.

Without the env variable set, every sign-up is rejected with 401.

## API

| Route | |
|---|---|
| `GET /store/newsletter-subscribers?email=` | `{ exists }`; secret header required |
| `POST /store/newsletter-subscribers` | `{ email, consent_text, consent_at, source }` → 201; secret header required |
| `GET /admin/newsletter-subscribers` | `?q=`, `limit`, `offset` → `{ subscribers, count, limit, offset }` |
| `DELETE /admin/newsletter-subscribers/:id` | GDPR delete |
| `GET /admin/newsletter-subscribers/export` | CSV with BOM, header from `messages.csvColumns` |
| `GET /admin/newsletter/messages` | `{ locale, messages }` for the admin page |

Error codes (`code` in the body): `already_subscribed` (422), `storefront_secret_invalid` (401).

Admin: the page `/app/newsletter` with its own menu entry.

## Exports

`NEWSLETTER_MODULE`, `NewsletterModuleService` (type; `getOptions()`), `NewsletterOptions`,
`resolveOptions`, `messages`, `resolveMessages`, `NewsletterMessages`, `NEWSLETTER_SOURCES`,
`NEWSLETTER_ERROR_CODES`, `subscribersCsv`.

## License

MIT
