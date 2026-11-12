# Contributing

## Changes to a package

Every change that affects a published package needs a changeset:

```sh
pnpm changeset
```

Pick the packages and the bump type (versions are independent per package) and describe the change
for the changelog. Commit the generated `.changeset/*.md` with your PR.

## Release flow

The organisation does not (yet) allow GitHub Actions to create pull requests, so the "Version
packages" PR of `changesets/action` cannot be opened. Versions are bumped in the PR itself:

1. In your PR branch run `pnpm changeset` (add the changeset) and then `pnpm changeset version`
   (bumps versions, writes the changelogs, consumes the changeset). Commit the bumps and
   `CHANGELOG.md` files with the change.
2. Merge the PR into `main`. `release.yml` finds no pending changesets and runs `pnpm release`,
   which publishes every version not yet in GitHub Packages.
3. Verify: `gh run list -R cloud-house/medusa-libs --workflow release.yml`, then
   `gh run view <id> --log` (look for the `New tag:` lines), and
   `NODE_AUTH_TOKEN=$(gh auth token) npm view @cloud-house/<package> version --registry=https://npm.pkg.github.com`
   (needs a token with `read:packages`).

A release can be re-run by hand from `main` with `gh workflow run release.yml --ref main`; the job
is skipped on any other ref.

Once the organisation enables "Allow GitHub Actions to create and approve pull requests", the
Version-PR flow works as well: merge PRs with a changeset and merge the "Version packages" PR that
the workflow opens (then skip `pnpm changeset version` in your branch).

## Medusa version

The Medusa version is set only in the `catalogs` section of `pnpm-workspace.yaml`:
`medusa` (exact, for `devDependencies`) and `medusa-peer` (`~` range, for `peerDependencies`).
Packages reference it as `catalog:medusa` / `catalog:medusa-peer`; never write a Medusa version
directly in a package's `package.json`. Published manifests must not contain `catalog:` or
`workspace:`.

## Checks

`pnpm lint && pnpm typecheck && pnpm build && pnpm test` must pass; CI runs the same.
