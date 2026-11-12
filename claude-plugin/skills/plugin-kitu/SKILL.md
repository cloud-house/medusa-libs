---
name: plugin-kitu
description: Use when adding a new package or Medusa plugin to the medusa-libs kit repo, or when moving an existing module out of a shop into the kit - package structure, package.json exports, plugin options through the module service, PL and EN dictionaries, error codes, migrations that keep names, tests (unit, module, test-shop HTTP), changeset, publishing, wiring into a shop.
---

# Plugin kitu

Przepis oparty na tym, jak zrobiono `commerce-rules`, `medusa-newsletter` i `medusa-omnibus` (kroki 0-1 kitu). Zanim zaczniesz, przejrzyj skill `pulapki-medusa-next` (`medusa-plugin.md`, `medusa-testy.md`, `pnpm-monorepo.md`).

## 1. Czy to powinien być pakiet i jaki

- **Czysta logika** (bez Medusy, bez tekstów dla klienta, bez wiedzy o jednym sklepie): `packages/commerce-rules` (vitest, tsup, ESM + CJS). Nie dodawaj tam niczego specyficznego dla marki (nazwy tagów cache, polskie formy słów konkretnego asortymentu); to zostaje w sklepie.
- **Moduł, trasy, job, panel admina**: osobny plugin Medusy `packages/medusa-<nazwa>`.
- Zasada przy przenoszeniu: to samo kod ze sklepu, zmiany tylko konieczne do uogólnienia (opcje, słowniki, nazwy). Nie pisz od nowa.
- W kodzie, testach i dokumentacji kitu nie ma nazwy żadnego sklepu, sekretów ani adresów (`grep -rni <sklep> packages apps claude-plugin` pusty). Przykłady: „Acme”, „Shop”.

## 2. Struktura pluginu Medusy

```
packages/medusa-<nazwa>/
  package.json  LICENSE  README.md  CHANGELOG.md
  tsconfig.json         # build: declaration: true, wyklucza src/admin i testy
  tsconfig.test.json    # typecheck z testami
  jest.config.js  jest.setup.js   # TEST_TYPE=unit | integration:modules
  src/
    index.ts            # publiczne eksporty: stała modułu, typy, opcje, słowniki, kody błędów
    options.ts  messages.ts  errors.ts
    modules/<nazwa>/{index.ts,service.ts,models/,migrations/}
    api/{middlewares.ts,store/...,admin/...}
    jobs/  workflows/   # jeśli potrzebne
    admin/              # nawet pusty: src/admin/.gitkeep (plugin:build bez niego pada)
    lib/  __tests__/
```

`package.json`: `license: MIT`, `repository` z `directory`, `publishConfig` (`registry` GitHub Packages, `access: public`), `files: [".medusa/server"]`, `keywords` (`medusa-plugin`, `medusa-v2`), `engines`. Wersje Medusy tylko z catalogów `pnpm-workspace.yaml`: `catalog:medusa` (dokładne, devDependencies) i `catalog:medusa-peer` (`~`, peerDependencies); w opublikowanym pliku nie zostaje `catalog:` ani `workspace:`. Peery ogranicz do tego, czego plugin używa (plugin bez panelu: tylko `@medusajs/framework` i `@medusajs/medusa`).

Mapa `exports` (szablon pluginu Medusy) musi mieć, obok `.`, `./package.json`, `./workflows`, `./admin` i `./*`:

```json
"./.medusa/server/src/modules/*": "./.medusa/server/src/modules/*/index.js",
"./modules/*": "./.medusa/server/src/modules/*/index.js"
```

Bez pierwszej linii sklep nie znajdzie modułu pluginu. Wpis `"."` ma `types` wskazujące na `.medusa/server/src/index.d.ts` (stąd `declaration: true`).

## 3. Opcje pluginu

Medusa 2.21 rejestruje każdy `.medusa/server/src/modules/*` pluginu jako moduł z `options` z `plugins[].options` i przekazuje je do serwisu modułu jako drugi argument konstruktora. Trasy dostają tylko `req.scope`. Wzorzec:

1. `src/options.ts`: typ `XOptions` (wszystko opcjonalne) i `resolveOptions(options = {})`: uzupełnia domyślne, scala `messages` na słownik wybranego `locale`, rzuca przy nieprawidłowej wartości (aplikacja nie wstanie).
2. Serwis zapisuje opcje i je wystawia:

```ts
class XModuleService extends MedusaService({ Model }) {
  protected readonly options_: ResolvedXOptions
  // biome-ignore lint/suspicious/noExplicitAny: kontener MedusaService
  constructor(_container: Record<string, any>, options?: XOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService bierze wszystkie argumenty konstruktora
    super(...arguments)
    this.options_ = resolveOptions(options)
  }
  getOptions(): ResolvedXOptions { return this.options_ }
}
```

3. Trasy i middleware: `req.scope.resolve<XModuleService>(X_MODULE).getOptions()` (jeden helper w `lib/plugin-options.ts`). Walidator zależny od opcji buduj wewnątrz funkcji middleware (`validateAndTransformBody(schema)(req, res, next)`, memoizowany), bo `defineMiddlewares` jest statyczne.
4. Panel: własna trasa `GET /admin/<plugin>/messages` zwracająca `{ locale, messages }`; strona czyta ją przez react-query. Etykieta menu jest statyczna.
5. Sklep **nie** wpisuje tego samego modułu w `modules` (jego wpis wygrywa i opcje pluginu przepadają).
6. Zasada dla publicznych tras, które zapisują dane: sekret storefrontu z env (nazwa nagłówka i zmiennej jako opcje, domyślnie `x-storefront-secret` i `STOREFRONT_API_SECRET`), pusty sekret odrzuca każde żądanie kodem 401, porównanie stałoczasowe (`timingSafeEqual`). Test „rejects every sign-up when the secret env is empty” jest obowiązkowy.
7. Rzeczy statyczne (harmonogram joba, nazwa menu) nie są opcjami; powiedz to w README pakietu.

## 4. Słowniki PL i EN, kody błędów

- `messages.ts`: obiekty `pl` i `en` o tych samych kluczach, `resolveMessages(locale, overrides)`. Teksty `pl` są **identyczne** z tymi, które sklep ma dziś (testy sklepu sprawdzają je dosłownie). Domyślne `locale: 'pl'`.
- **Reguła:** `resolveMessages` i `resolveOptions` odfiltrowują klucze `undefined` z nadpisań przed scaleniem (`{...base, ...overrides}` skasuje tekst, gdy nadpisanie to `undefined`; błąd z newslettera 0.1.0). Test: „ignores undefined overrides”.
- Konwencja słowników: teksty są stringami z `{placeholderami}`, gdy trzeba je serializować (np. wysłać na stronę admina przez HTTP, jak w newsletterze); funkcjami, gdy są używane tylko po stronie serwera (jak w omnibusie).
- Błędy API: statusy HTTP jak w sklepie, plus stały `code` (stałe w `errors.ts`, eksportowane). `MedusaError` z trzecim argumentem działa dla `UNAUTHORIZED`, `NOT_FOUND`, `INVALID_DATA`, `NOT_ALLOWED`; dla `DUPLICATE_ERROR`, `CONFLICT` i `DB_ERROR` Medusa nadpisuje `code`, więc odpowiedz wprost z trasy: `res.status(422).json({ type: 'duplicate_error', code, message })`.

## 5. Wydzielanie istniejącego modułu ze sklepu

- Model, plik migracji, nazwy klas, klucz modułu i nazwa tabeli **bez zmian** (`diff` pusty z kodem sklepu), razem z `migrations/.snapshot-<moduł>.json` w repozytorium pluginu. `medusa plugin:build` nie kopiuje snapshotów do paczki, więc oba pakiety 0.1.0 (newsletter, omnibus) wyszły bez niego; konsumenci go nie potrzebują, liczy się tylko przy `db:generate` wewnątrz pluginu (nie naprawiaj builda przy okazji). Baza sklepu i tak pomija migrację.
- Dowód na kopii bazy sklepu, zanim wydasz wersję: `createdb -T baza kopia` (albo `create database kopia template baza` przez psql), `medusa db:migrate` na kopii. Oczekiwane: „Skipped. Database is up-to-date for module.”, liczba wierszy `mikro_orm_migrations` bez zmian, żadnego `drop`. Pusta tabela w bazie deweloperskiej to słaby dowód; liczy się tabela migracji. Kopię usuń.
- Zdarzenia: usuń prefiks sklepu z nazw (`price-history.recorded`), a w sklepie zaktualizuj subskrybentów.
- Prefiks logów i tym podobne wstrzykuj opcją (`logPrefix`).

## 6. Testy

- **Unit** (jest `TEST_TYPE=unit`, vitest w `commerce-rules`): opcje, słowniki (scalanie, `undefined`), walidatory, czyste funkcje.
- **Moduł** (`moduleIntegrationTestRunner` z `moduleOptions`): serwis, opcje dochodzą (`getOptions()`), wyścigi przez `Promise.all`.
- **HTTP** w `apps/test-shop` (`medusaIntegrationTestRunner`, plugin z workspace): ustaw w `medusa-config.ts` test-shopa jedną opcję inną niż domyślna i sprawdź ją przez HTTP, resztę asercji rób na domyślnych. Sprawdź kody błędów (`code` w ciele), pusty sekret (401), job (logger przez `jest.spyOn`, po użyciu `mockRestore`).
- `createStore` w helperach nie jest idempotentne: wołaj raz na test.
- Postgres: `docker compose up -d` (port 55532) i zmienne z README repo. Testy HTTP wymagają `STOREFRONT_API_SECRET` (test-shop ustawia domyślny w `integration-tests/setup.js`).
- Przed PR: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`.

## 7. Changeset, PR, publikacja

1. Gałąź, commity małe (`feat(<pakiet>): …`, `docs: …`), `pnpm changeset` (wybierz pakiety i typ; wersje niezależne). Pierwsze wydanie to `0.1.0`.
2. Dopóki organizacja blokuje Actions przed tworzeniem PR-ów: w tej samej gałęzi `pnpm changeset version` (podbija wersję i CHANGELOG, zużywa changeset), commit. Zmiany tylko w dokumentacji nie potrzebują changesetu.
3. Sprawdzenie paczki: `pnpm pack --dry-run` w katalogu pakietu. Ma zawierać build (`.medusa/server` albo `dist`), `LICENSE`, `README.md`, `package.json` bez `catalog:` i `workspace:` (`grep` po spakowanym manifeście).
4. `gh pr create` (opis kończy się linią o Claude Code), `gh pr checks --watch`, przy zielonym CI `gh pr merge --squash --delete-branch`.
5. Po scaleniu `release.yml` publikuje do GitHub Packages. Sprawdź w logu: `gh run list --workflow release.yml`, `gh run view <id> --log` (ma być „packages published successfully”). `npm view` wymaga tokenu z `read:packages`. Przy 502 przy merge i braku przebiegu: `workflow_dispatch`.
6. Nowy pakiet jest po publikacji prywatny: przełącz na Public w GitHubie (Org Settings → Packages musi pozwalać na pakiety publiczne; nie da się tego zrobić API).

## 8. Podpięcie w sklepie i przejście sklepu

1. Token (raz): zob. README kitu i `pnpm-monorepo.md`. Projektowy `.npmrc` sklepu ma tylko `@cloud-house:registry=https://npm.pkg.github.com`, token w `~/.npmrc` jako `${NODE_AUTH_TOKEN}`; `export NODE_AUTH_TOKEN=$(gh auth token)` przed `pnpm install`.
2. `pnpm add --save-exact @cloud-house/<pakiet>@<wersja>` (bez `^`; `pnpm link` tylko lokalnie i nigdy w commicie: `git diff` bez `link:` i `file:`).
3. `medusa-config.ts`: wpis w `plugins` z opcjami sklepu (nazwa nagłówka, `logPrefix`…), usuń moduł z `modules`.
4. Usuń ze sklepu przeniesiony kod i jego testy, jeśli kit testuje to samo w całości; testy integracji sklepu zostają. Poprawy importów (`grep` po starych ścieżkach, w tym skryptach seed i testach) wyłapie `pnpm typecheck`.
5. Weryfikacja: migracja na kopii bazy (pkt 5 wyżej), `pnpm build && pnpm typecheck && pnpm lint && pnpm test`, E2E sklepu, ręczne sprawdzenie panelu pluginu i joba.
6. Po usuwaniu tras: skasuj `apps/storefront/.next` (zob. `next-cache-metadane.md`).
7. Dokumentacja sklepu: wpis w dzienniku decyzji, a CI, Docker i hosting potrzebują `NODE_AUTH_TOKEN` z `read:packages` przy `pnpm install`.
