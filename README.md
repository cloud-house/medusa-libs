# medusa-libs

Medusa 2 plugins and commerce logic shared by cloud-house shops. Pnpm + Turbo monorepo, versioned
per package with [Changesets](https://github.com/changesets/changesets), published to GitHub Packages
under the `@cloud-house` scope.

## Packages

Planned (none published yet):

- `@cloud-house/commerce-rules`
- `@cloud-house/medusa-newsletter`
- `@cloud-house/medusa-omnibus`

## Installing in a shop

The packages live in GitHub Packages, which requires a token even for public packages.

1. Create a token with the `read:packages` scope (classic personal access token, or
   `gh auth refresh -h github.com -s read:packages`).
2. Add to the shop's `.npmrc` (never commit the token):

   ```
   @cloud-house:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
   ```

3. `export GITHUB_PACKAGES_TOKEN=...` and install with an exact version, e.g.
   `pnpm add --save-exact @cloud-house/medusa-newsletter@0.1.0`.

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
