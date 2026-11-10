# Contributing

## Changes to a package

Every change that affects a published package needs a changeset:

```sh
pnpm changeset
```

Pick the packages and the bump type (versions are independent per package) and describe the change
for the changelog. Commit the generated `.changeset/*.md` with your PR.

## Release flow

1. A PR with a changeset is merged into `main`.
2. The release workflow opens (or updates) a "Version packages" PR that bumps versions and writes
   changelogs.
3. Merging that PR publishes the new versions to GitHub Packages.

## Medusa version

The Medusa version is set only in the `catalogs` section of `pnpm-workspace.yaml`:
`medusa` (exact, for `devDependencies`) and `medusa-peer` (`~` range, for `peerDependencies`).
Packages reference it as `catalog:medusa` / `catalog:medusa-peer`; never write a Medusa version
directly in a package's `package.json`. Published manifests must not contain `catalog:` or
`workspace:`.

## Checks

`pnpm lint && pnpm typecheck && pnpm build && pnpm test` must pass; CI runs the same.
