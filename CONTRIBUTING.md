# Contributing

## Changes to a package

Every change that affects a published package needs a changeset:

```sh
pnpm changeset
```

Pick the packages and the bump type (versions are independent per package) and describe the change
for the changelog. Commit the generated `.changeset/*.md` with your PR.

## Release flow

1. Merge your PR (with its `.changeset/*.md`) into `main`. `main` is protected: the `check` CI job
   must be green.
2. `release.yml` (`changesets/action`) opens or updates the **"Version packages"** PR: version
   bumps and `CHANGELOG.md` entries for every pending changeset.
3. Merge the "Version packages" PR when you want to release. `release.yml` then finds no pending
   changesets and runs `pnpm release`, which publishes every version not yet in GitHub Packages.
4. Verify: `gh run list -R cloud-house/medusa-libs --workflow release.yml`, then
   `gh run view <id> --log` (look for the `New tag:` lines), and
   `NODE_AUTH_TOKEN=$(gh auth token) npm view @cloud-house/<package> version --registry=https://npm.pkg.github.com`
   (needs a token with `read:packages`).

Shortcut for a single urgent release: run `pnpm changeset version` in your own PR branch and commit
the bumps and changelogs; after the merge `release.yml` publishes directly, without a Version PR.

A release can be re-run by hand from `main` with `gh workflow run release.yml --ref main`; the job
is skipped on any other ref.

## Medusa version

The Medusa version is set only in the `catalogs` section of `pnpm-workspace.yaml`:
`medusa` (exact, for `devDependencies`) and `medusa-peer` (`~` range, for `peerDependencies`).
Packages reference it as `catalog:medusa` / `catalog:medusa-peer`; never write a Medusa version
directly in a package's `package.json`. Published manifests must not contain `catalog:` or
`workspace:`.

## Checks

`pnpm lint && pnpm typecheck && pnpm build && pnpm test` must pass; CI runs the same.
