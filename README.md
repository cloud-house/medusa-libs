# medusa-libs

Medusa 2 plugins and commerce logic shared by cloud-house shops. Pnpm + Turbo monorepo, versioned
per package with [Changesets](https://github.com/changesets/changesets), published to GitHub Packages
under the `@cloud-house` scope.

## Packages

- [`@cloud-house/commerce-rules`](packages/commerce-rules) – pure commerce rules
- [`@cloud-house/medusa-newsletter`](packages/medusa-newsletter) – Medusa plugin: newsletter sign-ups
- [`@cloud-house/medusa-omnibus`](packages/medusa-omnibus) – Medusa plugin: price history for the Omnibus directive

| Package | Version | What it is | Options |
|---|---|---|---|
| `@cloud-house/commerce-rules` | 0.1.0 | Pure commerce rules (price format, plurals, tax id, seller, Omnibus, discounts, stock) | `formatPrice(amount, { currency, locale })`, `pluralize(count, forms, locale)` |
| `@cloud-house/medusa-newsletter` | 0.1.1 | Sign-ups with proof of consent, admin page `/app/newsletter`, CSV, GDPR delete | `locale`, `messages`, `storefrontSecret: { header, env }`, `sources` |
| `@cloud-house/medusa-omnibus` | 0.1.1 | Hourly price snapshots and the `priceHistory` module | `locale`, `messages`, `logPrefix` |

Versions are independent per package; see each package's README and CHANGELOG.

## Example `medusa-config.ts`

```ts
import { defineConfig } from '@medusajs/framework/utils'

module.exports = defineConfig({
  projectConfig: { /* database, secrets, CORS */ },
  plugins: [
    {
      resolve: '@cloud-house/medusa-newsletter',
      options: {
        locale: 'pl',
        storefrontSecret: { header: 'x-acme-storefront-secret', env: 'STOREFRONT_API_SECRET' },
      },
    },
    { resolve: '@cloud-house/medusa-omnibus', options: { logPrefix: 'Acme' } },
  ],
})
```

Run `medusa db:migrate` after adding a plugin. Do not also list a plugin's module under `modules`:
that entry replaces the plugin's module and its options.

## Installing in a shop

The packages live in GitHub Packages, which requires a token even for public packages: without
`NODE_AUTH_TOKEN` (or with an expired one) `pnpm install` fails with 401. CI, Docker builds and
hosting need the same token with `read:packages`.

1. Create a token with the `read:packages` scope (classic personal access token, or
   `gh auth refresh -h github.com -s read:packages`).
2. Add to the shop's project `.npmrc` only the registry (no token; pnpm 11 ignores credentials
   with env variables in a project `.npmrc`):

   ```
   @cloud-house:registry=https://npm.pkg.github.com
   ```

3. Put the token reference in your user-level `~/.npmrc` (CI: `actions/setup-node` with
   `registry-url: https://npm.pkg.github.com` writes the same line), and export the token:

   ```sh
   grep -qF 'npm.pkg.github.com/:_authToken' ~/.npmrc 2>/dev/null \
     || echo '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' >> ~/.npmrc
   export NODE_AUTH_TOKEN=...
   ```

4. Install with an exact version, e.g. `pnpm add --save-exact @cloud-house/medusa-newsletter@0.1.1`.

## Claude Code plugin

`/plugin marketplace add cloud-house/medusa-libs`, then install `kit-sklepow`: skills `pulapki-medusa-next`
(collected pitfalls), `plugin-kitu` (how to add a package or plugin to this repo) and `nowy-sklep` (draft).

## Development

Requires Node 22.22+ or 24 (see `.nvmrc`) and pnpm 11.

```sh
pnpm install
pnpm lint
pnpm build
pnpm test
```

Plugin integration tests need Postgres. A local one on port 55532:

```sh
docker compose up -d
export DB_HOST=localhost DB_PORT=55532 DB_USERNAME=medusa DB_PASSWORD=medusa
export JWT_SECRET=test-jwt-secret COOKIE_SECRET=test-cookie-secret
export STOREFRONT_API_SECRET=test-only-storefront-api-secret
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the release flow.

## License

MIT
