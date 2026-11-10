# pnpm 11, monorepo, rejestr, CI

## pnpm 11 ignoruje `${ENV}` z tokenem w projektowym `.npmrc`
Słowa: `.npmrc`, `_authToken`, `${NODE_AUTH_TOKEN}`, GitHub Packages, 401, `pnpm config get`

- **Objaw:** `pnpm install` ostrzega, że linię z tokenem zignorowano, a instalacja z `npm.pkg.github.com` kończy się 401.
- **Przyczyna:** pnpm 11 nie rozwija `${ZMIENNA}` w liniach autoryzacji projektowego `.npmrc`.
- **Rozwiązanie:** projektowy `.npmrc` ma tylko `@cloud-house:registry=https://npm.pkg.github.com`. Token trafia do `~/.npmrc` użytkownika jako `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` i zmiennej środowiskowej (lokalnie `export NODE_AUTH_TOKEN=$(gh auth token)`). W CI zrobi to `actions/setup-node` z `registry-url` i `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Weryfikacja: `pnpm config get '//npm.pkg.github.com/:_authToken'`. Token nigdy w repo.

## Organizacja blokuje prawa zapisu dla workflow
Słowa: GitHub Actions, `default_workflow_permissions`, 409, `changesets/action`, "Version packages"

- **Objaw:** `gh api -X PUT repos/ORG/REPO/actions/permissions/workflow -f default_workflow_permissions=write` zwraca 409 "Write permissions for workflows are disabled by the organization".
- **Przyczyna:** ustawienie na poziomie organizacji wyłącza zapis domyślnego tokenu dla repo.
- **Rozwiązanie:** w workflow deklaruj uprawnienia jawnie w pliku (`permissions: contents: write, pull-requests: write, packages: write`), a zwykłym workflow (CI) zostaw `contents: read`. Jeśli PR-y changesetów nadal są blokowane, zmień ustawienie w organizacji (wymaga admina organizacji).

## Medusa nie startuje przez hoisting i `uuid`
Słowa: `publicHoistPattern`, `packageExtensions`, `uuid`, `@medusajs/core-flows`, jest ESM

- **Objaw:** testy backendu nie startują; panel admina nie znajduje `react-router-dom` / `@tanstack/react-query` / `react-i18next`.
- **Przyczyna:** `@medusajs/core-flows` importuje `uuid` bez deklaracji; po przelinkowaniu pnpm podstawia ukryty `uuid@13` (tylko ESM), który psuje Jest. Panel i moduły oczekują zależności Medusy w korzeniu.
- **Rozwiązanie:** w `pnpm-workspace.yaml`: `publicHoistPattern: ["*@medusajs/*", "@tanstack/react-query", "react-i18next", "react-router-dom"]` oraz `packageExtensions` z `@medusajs/core-flows` -> `uuid: ^11.1.1`. Usuń inne zależności, które przynoszą `uuid@13` (np. po wycofaniu CMS).

## Zmiany w pakiecie, a aplikacja widzi stary build
Słowa: `dist`, rebuild, po pull, workspace, `catalog-rules`, stale

- **Objaw:** po `git pull` albo w nowym worktree backend/storefront pada na brakujące eksporty (np. brakująca stała), walidacja zwraca 500 ze zagadkowym błędem zod, skrypty migracji nie startują.
- **Przyczyna:** aplikacje czytają zbudowane `dist` pakietów workspace, a `dist` nie jest w gicie.
- **Rozwiązanie:** po pullu i w świeżym worktree najpierw `pnpm --filter <pakiet> build` (albo `pnpm build`), dopiero potem testy i dev. Nowe devDependencies wymagają `pnpm install --frozen-lockfile`.

## Zła wersja Node
Słowa: Node 26, `.nvmrc`, `engines`, `check-node`, preinstall

- **Objaw:** dziwne błędy toolchainu na domyślnym (zbyt nowym) Node; skrypty w powłoce nieinteraktywnej biorą systemowy Node.
- **Przyczyna:** Medusa 2.21 wspiera tylko LTS (22.22+ lub 24); Node 25+ psuje część narzędzi.
- **Rozwiązanie:** `.nvmrc` (24), `engines` + `engineStrict: true` i skrypt `check-node` w `preinstall`/`build`/`test`; w powłoce nieinteraktywnej `export PATH=$HOME/.nvm/versions/node/v24.14.0/bin:$PATH`.

## Turbo: flagi po `--` trafiają do narzędzia
Słowa: `turbo run`, `--concurrency`, `--continue`, `--`

- **Objaw:** `pnpm test -- --concurrency=1` kończy się błędem nieznanej opcji Vitest.
- **Przyczyna:** wszystko po `--` jest przekazywane do skryptu, nie do turbo.
- **Rozwiązanie:** `pnpm test --concurrency=1 --continue` (bez `--`).

## Biome: nowe pliki spoza reguł
Słowa: biome, `files.includes`, HTML, `.medusa`

- **Objaw:** Biome 2 lintuje wygenerowane katalogi (`.medusa`) i makiety HTML.
- **Przyczyna:** domyślnie sprawdza cały katalog.
- **Rozwiązanie:** wyłącz `.medusa` i kopie makiet w `files.includes`; nie używaj `biome --unsafe`.

## Wiele projektów na tych samych portach
Słowa: porty, Postgres, Redis, Docker, `EADDRINUSE`

- **Objaw:** usługi nie startują, bo porty (5432, 6379, 9000) są zajęte przez inny projekt.
- **Przyczyna:** domyślne porty Medusy i Dockera kolidują z innymi projektami na tej samej maszynie.
- **Rozwiązanie:** własne porty dla bazy, Redisa i MinIO w `docker-compose` i `.env.test`; udokumentuj je w README. Docker Desktop potrafi zawisnąć (CLI i Postgres nie odpowiadają), zwykle wraca sam po dłuższym czasie.
