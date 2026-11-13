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

- **Objaw:** błędy toolchainu na zbyt nowym Node (systemowy Node był w wersji 26); skrypty w powłoce nieinteraktywnej biorą systemowy Node.
- **Przyczyna:** Medusa 2.21 wspiera tylko LTS (22.22+ lub 24); komentarz w `scripts/check-node.mjs` pierwszego sklepu mówi, że Node 25+ psuje m.in. storefront Next.js.
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
- **Rozwiązanie:** własne porty dla bazy, Redisa i MinIO w `docker-compose` i `.env.test`; udokumentuj je w README. Raz zdarzyło się, że Docker Desktop zawisł (CLI i Postgres nie odpowiadały) i wrócił sam po ok. godzinie; przyczyny nie ustalono.

## GitHub Packages wymaga tokenu także dla pakietów publicznych
Słowa: `npm.pkg.github.com`, 401, `read:packages`, public, "Package creation", widoczność pakietu

- **Objaw:** anonimowe `GET` na pakiet z `npm.pkg.github.com` daje 401, choć pakiet jest publiczny; `gh api` na pakiet daje 403; nie da się przełączyć nowego pakietu na Public.
- **Przyczyna:** rejestr npm GitHuba zawsze wymaga uwierzytelnienia (tak działa GitHub Packages). Zmiana widoczności pakietu jest możliwa tylko w interfejsie, nie przez API, i tylko gdy organizacja pozwala na tworzenie pakietów publicznych.
- **Rozwiązanie:** każdy konsument (dev, CI, Docker, hosting) ma token z `read:packages` (zob. wpis o `.npmrc` wyżej). Zanim przełączysz pakiet na Public, włącz w Org Settings → Packages → Package creation publiczne pakiety.

## Brak tokenu przy instalacji: 401 i ostrzeżenie o zmiennej
Słowa: `Failed to replace env`, `NODE_AUTH_TOKEN`, 401, `pnpm install`

- **Objaw:** `pnpm install` (a nawet inne polecenia pnpm) wypisuje „Failed to replace env in config: ${NODE_AUTH_TOKEN}”; instalacja pakietu `@cloud-house/*` kończy się 401.
- **Przyczyna:** `~/.npmrc` odwołuje się do `${NODE_AUTH_TOKEN}`, a zmienna nie jest ustawiona w tej powłoce albo token wygasł.
- **Rozwiązanie:** `export NODE_AUTH_TOKEN=$(gh auth token)` (lokalnie), sekret w CI/Dockerze/hostingu. Obserwacja: przy poleceniach innych niż install samo ostrzeżenie niczego nie zepsuło (nieszkodliwe w tych przypadkach).

## `gh` nie ma uprawnień `read:packages`
Słowa: `gh auth refresh`, `write:packages`, `npm view`, 403

- **Objaw:** `npm view @cloud-house/...` zwraca 401, `gh api orgs/<org>/packages/...` 403, mimo że `gh` jest zalogowany.
- **Przyczyna:** domyślny token `gh` nie ma zakresu pakietów.
- **Rozwiązanie:** `gh auth refresh -h github.com -s read:packages,write:packages` (polecenie interaktywne, uruchamia je człowiek); potem `export NODE_AUTH_TOKEN=$(gh auth token)`.

## Release: Actions nie otwiera PR-a z wersjami
Słowa: `changesets/action`, "Version packages", `workflow_dispatch`, 502, `pnpm changeset version`, `pnpm release`

- **Objaw:** `changesets/action` nie może otworzyć PR-a „Version packages” (ustawienie organizacji blokuje tworzenie PR-ów przez Actions i zapis dla workflow, 409); po scaleniu PR-a raz nie powstał żaden przebieg release.
- **Przyczyna:** ustawienie organizacji „Allow GitHub Actions to create and approve pull requests” jest wyłączone (zmienia je admin organizacji). Brak przebiegu po scaleniu: błąd 502 po stronie GitHuba przy merge (przyczyna nieustalona).
- **Rozwiązanie:** obejście bez zmiany ustawienia: w gałęzi PR-a `pnpm changeset` i od razu `pnpm changeset version` (podbija wersję, pisze CHANGELOG, zużywa changeset), commit; po scaleniu `release.yml` nie znajduje changesetów i uruchamia `pnpm release` (publikacja). Workflow ma też `workflow_dispatch`, żeby dało się go uruchomić ręcznie. Publikację sprawdzaj w logu przebiegu (`gh run view <id> --log`). Docelowo: admin organizacji włącza „Allow GitHub Actions to create and approve pull requests” (Org Settings → Actions → General → Workflow permissions), a potem to samo w repo (`gh api -X PUT repos/ORG/REPO/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true`); w repo pole jest wyszarzone, dopóki organizacja go nie odblokuje. W kicie włączone 2026-11-12.

## PR „Version packages” od bota kończy CI jako `action_required`
Słowa: `action_required`, `changesets/action`, `GITHUB_TOKEN`, `check`, "Version packages", `approve`

- **Objaw:** PR „Version packages” otwarty przez `release.yml` nie ma zielonego `check`; przebieg CI ma status `action_required` i nic się nie dzieje, a `main` bez zielonego `check` nie pozwala scalić.
- **Przyczyna:** przebiegi wywołane przez PR od bota (`GITHUB_TOKEN`) wymagają ręcznego zatwierdzenia (ustawienie repozytorium dla przebiegów z PR-ów spoza zaufanych; źródło: obserwacja w `cloud-house/medusa-libs` przy PR-ach #13 i kolejnych po włączeniu Actions-PR 2026-11-12; dokładny mechanizm GitHuba nieustalony).
- **Rozwiązanie:** człowiek (nie bot) zatwierdza przebieg: `gh api -X POST repos/<owner>/<repo>/actions/runs/<id>/approve` (id z `gh run list --branch changeset-release/main`), potem `gh pr checks --watch` i zwykłe scalenie. Bez `--admin` i bez zmiany ochrony `main`.

## Changesets podbija patch dependentów przy minorze zależności
Słowa: `changeset version`, `dependents`, `updateInternalDependencies`, patch, "Version packages"

- **Objaw:** po zmianie `commerce-rules` na minor PR „Version packages” podbija też `medusa-omnibus`, `medusa-brands` i inne pakiety, którym nikt nie dopisał changesetu.
- **Przyczyna:** pakiety zależą od `commerce-rules` zakresem `^` / dokładną wersją, a changesets aktualizuje wewnętrzne zależności i podnosi patch dependentów (zachowanie oczekiwane; źródło: PR-y „Version packages” #13, #21 kroku 2).
- **Rozwiązanie:** nic nie poprawiaj; sklep po wydaniu aktualizuje wersje tych pakietów razem i dopisuje je do `minimumReleaseAgeExclude`.
