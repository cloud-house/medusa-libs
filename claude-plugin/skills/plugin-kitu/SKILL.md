---
name: plugin-kitu
description: Use when adding a new package or Medusa plugin to the medusa-libs kit repo, or when moving an existing module out of a shop into the kit - package structure, package.json exports, plugin options through the module service, PL and EN dictionaries, error codes, migrations that keep names, tests (unit, module, test-shop HTTP), changeset, publishing, wiring into a shop.
---

# Plugin kitu

Przepis oparty na tym, jak zrobiono `commerce-rules`, `medusa-newsletter`, `medusa-omnibus` (kroki 0-1 kitu) oraz `medusa-brands`, `medusa-favorites`, `medusa-revalidation` i `next-medusa` (krok 2) oraz `medusa-emails` i `medusa-accounts` (krok 3). Zanim zaczniesz, przejrzyj skill `pulapki-medusa-next` (`medusa-plugin.md`, `medusa-testy.md`, `pnpm-monorepo.md`).

## 1. Czy to powinien być pakiet i jaki

- **Czysta logika** (bez Medusy, bez tekstów dla klienta, bez wiedzy o jednym sklepie): `packages/commerce-rules` (vitest, tsup, ESM + CJS). Nie dodawaj tam niczego specyficznego dla marki (nazwy tagów cache, polskie formy słów konkretnego asortymentu); to zostaje w sklepie.
- **Moduł, trasy, job, panel admina**: osobny plugin Medusy `packages/medusa-<nazwa>`.
- **Biblioteka zamiast pluginu** (zwykły pakiet npm, bez `plugins[]` i bez modułu), gdy kod nie ma własnych tabel, tras ani panelu i sklep ma go po prostu zaimportować: `medusa-revalidation` (kod w backendzie: wysyłka tagów, fabryka subscribera; sklep pisze własny plik subscribera, bo Medusa ładuje subscribery tylko z `src/subscribers` projektu) i `next-medusa` (kod w storefroncie Next). Test: czy to ma migracje, trasę albo stronę panelu? Tak = plugin; nie = biblioteka. Biblioteka: tsup, ESM + CJS, `peerDependencies` tylko na to, co kod faktycznie importuje.
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
4a. **Plugin bez tabel, który potrzebuje opcji w subskrybentach, workflow i trasach** (`medusa-accounts`): zarejestruj mały moduł-„trzymacz” opcji (`ACCOUNTS_MODULE`): `MedusaService({})` bez modeli, konstruktor robi `resolveOptions(options)`, `getOptions()`. Nie ma migracji ani katalogu `models/`, więc plugin nie dodaje tabeli do bazy sklepu (sprawdź: `db:migrate` na kopii bazy mówi „Skipped”, a w `.medusa/server/src` nie ma `migrations/` ani `models/`). Jeden helper `accountsOptions(container)` czyta opcje wszędzie; subskrybent dostaje w 2.21 surowe `pluginOptions`, ale workflow, kroki i trasy nie, więc czytaj zawsze przez moduł (opcje są wtedy rozwiązane i ze słownikiem).
4b. **Haki sklepu jako funkcje w opcjach**: logika, którą zna tylko sklep, wchodzi opcją-funkcją `(container, ...) => ...`, nie importem. `resolveContact` (blok kontaktowy maili, typ `ContactResolver` z `medusa-emails`; leży w opcjach pluginów, które go używają, nie w `medusa-emails`), `onAccountDeleted: [async (container, customerId) => ...]` (sprzątanie przy usunięciu konta, np. ulubione; wołane po kolei, rzucenie przerywa usuwanie, brak kompensacji dla już wymazanych danych). Wartości zgodne z umową istniejącego sklepu (format e-maila skasowanego konta `deletedEmail`, flaga w metadanych zamówienia `createAccountFlag`) też są opcjami z neutralnym domyślnym, żeby sklep z danymi zachował swój format.
4c. **Plugin z tabelami, który zna tylko „swoją” domenę** (`medusa-fakturownia`): moduł z modelami i migracjami jedzie w pakiecie (te same nazwy plików migracji i schemat, jeśli sklep już je ma – wtedy `db:migrate` nic nie dodaje), a dane, które zna tylko kasa sklepu, wchodzą funkcjami w opcjach (`resolveOrder`, `resolveReturnOrder`, `resolveReturn`, typy w pakiecie). Opcje docierają do subskrybentów, joba i tras przez serwis modułu (`getOptions()`, jak w 4a), a brakująca wymagana funkcja przerywa start (`fakturownia_missing_option`; Medusa tworzy serwisy modułów przy starcie). Przed wydaniem przepuść sklep przez lokalny tarball (`pnpm pack`, `file:` w `package.json`), potem przypnij wersję z rejestru.
4d. **Plugin bez własnych tabel, ale z opcjami funkcyjnymi** (`medusa-returns`): domena to natywny byt Medusy (zwroty), więc pakiet nie ma modeli ani migracji – tylko moduł-uchwyt (`Module(NAZWA, { service })`, serwis przyjmuje opcje w konstruktorze, waliduje je i wystawia `getOptions()`), żeby subskrybenci, workflow i trasy mogły je czytać (`container.resolve(NAZWA).getOptions()`). Teksty, które zakładają, co sklep sprzedaje (porady o pakowaniu, zdania o fakturach), nie należą do szablonów w pakiecie: wchodzą opcją (`emailCopy`), bez wartości są pomijane, a sklep, który je miał, przekazuje dokładnie dotychczasowe zdania – snapshoty maili zostają bez zmian. Reguły potrzebne i backendowi, i storefrontowi (okno zwrotu, komunikaty, kształty odpowiedzi API) idą do `commerce-rules`, a stara paczka reguł sklepu re-eksportuje je (`export *`), żeby nie zmieniać importów w storefroncie; `commerce-rules` wychodzi w tym samym wydaniu, więc w walidacji na tarballach sklep potrzebuje `overrides` na ten pakiet.
4e. **Reguła domenowa jako deklaracja plus funkcja z domyślną implementacją** (`medusa-furgonetka`, klasy gabarytów): sklep deklaruje *rodzaje* (`parcelClasses`: klucz, nazwa, skutek), a przypisanie produktu do rodzaju robi funkcja z opcji (`resolveParcelClasses`), z **domyślną wersją czytającą `product.metadata`** – nowy sklep nic nie pisze, sklep z danymi w innym miejscu podaje własną funkcję i niczego nie migruje. Klucze z funkcji, których nikt nie zadeklarował, są ignorowane z jednym ostrzeżeniem (literówka nie zatrzymuje zamówienia). Gdy klucz rodzaju trafia do kolumny, która była enumem DML (`check` w bazie), kolumna staje się tekstem, a **jedna addytywna migracja** zdejmuje `check` (`alter table … drop constraint if exists <tabela>_<kolumna>_check`; stare migracje zostają bez zmian). Wszystko, co identyfikuje sklep w świecie zewnętrznym (prefiks referencji paczek, nazwa nadawcy), to wymagana opcja, nie stała w pakiecie. Domyślna funkcja opcji leży w osobnym pliku niż moduł, który ją importuje – inaczej cykl `options → moduł → options`.
4f. **Rejestr rodzajów w opcjach** (`medusa-content`): sklep przekazuje `kinds` (lista `defineKind`: typ, schemat, widok, odwołania, haki) – silnik, trasy i panel nie znają żadnego rodzaju z góry; gotowe rodzaje dają `contentKinds()`, sklep dokłada własne (np. `entity` dla treści produktu). Odczyt opcji w trasach, subskrybentach i workflow przez `contentOptions(container)`. Panel rozszerza się przez rejestry `globalThis` (`registerHomeBlock`, `registerHubSection`) z `@cloud-house/medusa-content/admin-kit`.
4g. **Pakiet storefrontu z fabrykami zamiast globali** (`next-content`): sklep tworzy instancje (`createContentClient({ fetch, viewVersion, versionHeader })`, `createPreviewSession({ cookieName })`, `createPreviewRoutes(...)`) i eksportuje je z cienkich plików (`lib/content/data-client.ts`, `lib/cms/preview-session.ts`); trasy to jedna linia (`export const { GET } = createPreviewRoutes(...).enter`). Tagi cache, komponenty z wyglądem i rodzaje treści sklepu (quiz przez `kind(path)`) zostają w sklepie.
4h. **Plugin domeny bez tabel i zasada „klasa → blokada” z cudzego pluginu** (`medusa-checkout-pl`): moduł tylko z opcjami (jak `shopReturns`), trasy, subskrybenci i hooki workflow ładują się z pluginu; reguła zależna od innego pluginu (klasy gabarytów z `medusa-furgonetka`) pyta go przez jego eksport (`parcelClassesOf`) i **nie rzuca**, gdy tamten plugin nie jest zarejestrowany. Teksty dla klienta są opcjami z ogólnymi domyślnymi; sklep nadpisuje je w jednym pliku (`lib/checkout-config.ts`). Opcja z kontekstem (`resolveContact(container, { logger })`) zamiast stałych ciągów w logach.
4i. **Pakiet storefrontu = czysta logika, sklep = cienkie pliki** (`next-commerce`): pakiet nie importuje `next/*` ani `server-only` (test na `dist`), akcje `'use server'`, ciasteczka i loadery z sesją zostają w sklepie. Przy przenoszeniu sklep zostawia **moduły-podkładki** w starych ścieżkach (`lib/cart/view.ts` re-eksportuje pakiet z opcjami sklepu), więc komponenty i dotychczasowe testy sklepu nie zmieniają importów i biegną przez pakiet jako siatka bezpieczeństwa.
5. Sklep **nie** wpisuje tego samego modułu w `modules` (jego wpis wygrywa i opcje pluginu przepadają).
6. Zasada dla publicznych tras, które zapisują dane: sekret storefrontu z env (nazwa nagłówka i zmiennej jako opcje, domyślnie `x-storefront-secret` i `STOREFRONT_API_SECRET`), pusty sekret odrzuca każde żądanie kodem 401, porównanie stałoczasowe (`timingSafeEqual`). Test „rejects every sign-up when the secret env is empty” jest obowiązkowy.
7. Rzeczy statyczne (harmonogram joba, nazwa menu) nie są opcjami; powiedz to w README pakietu.

## 3a. Provider powiadomień (`medusa-emails`) i szablony

- Provider (`@cloud-house/medusa-emails/providers/resend`) rejestruje się w module Notification sklepu (`id: 'resend'`), nie w `plugins`; jego opcje (`theme`, `templates`, `apiKey`...) są opcjami providera.
- **Lista szablonów w opcjach zamiast globalnego rejestru:** `templates: [...]`, nazwy unikalne (`resolveOptions` rzuca przy duplikacie). Plugin, który wysyła maile, eksportuje swoje szablony (`accountEmailTemplates`), a sklep dokłada je do listy obok własnych. Szablony innych domen (zamówienie, faktura, zwrot) jadą z pluginem tej domeny, nie z `medusa-emails`; dopóki takiego pluginu nie ma, zostają w sklepie.
- Szablon to `{ name, render(data, ctx) }`, `ctx` niesie rozwiązany motyw, słowniki i `locale`. Nazwy marki bierz z `ctx.theme`, nie ze stałych.
- Wysyłka przez `sendEmailWorkflow` (`@cloud-house/medusa-emails/workflows/send-email`, wejście poza głównym eksportem, żeby `index` nie ładował workflow). Teksty błędów i logi providera są po angielsku, z kodami `emails_*`; klient (sklep) rozgałęzia się po `code`.
- Przenosząc layout ze sklepu sprawdź zgodność bajt w bajt snapshotem HTML (zob. `pulapki-medusa-next/references/medusa-plugin.md`).

## 4. Słowniki PL i EN, kody błędów

- `messages.ts`: obiekty `pl` i `en` o tych samych kluczach, `resolveMessages(locale, overrides)`. Teksty `pl` są **identyczne** z tymi, które sklep ma dziś (testy sklepu sprawdzają je dosłownie). Domyślne `locale: 'pl'`.
- **Reguła:** `resolveMessages` i `resolveOptions` odfiltrowują klucze `undefined` z nadpisań przed scaleniem (`{...base, ...overrides}` skasuje tekst, gdy nadpisanie to `undefined`; błąd z newslettera 0.1.0). Test: „ignores undefined overrides”.
- Konwencja słowników: teksty są stringami z `{placeholderami}`, gdy trzeba je serializować (np. wysłać na stronę admina przez HTTP, jak w newsletterze); funkcjami, gdy są używane tylko po stronie serwera (jak w omnibusie).
- **Konwencja kodów błędów:** każdy kod domenowy to `<domena>_<powód>` małymi literami ze znakami `_` (snake_case), gdzie `<domena>` to prefiks pluginu używany w jego stałej `ERROR_CODES` (`newsletter_`, `brand_`, `favorites_`). Kod bez prefiksu (`already_subscribed`) zderza się z kodami Medusy i innych pluginów, więc nie jest dozwolony. Zmiana kodu to zmiana łamiąca w wersji 0.x (minor + wpis w README i CHANGELOG). Statusy i teksty zostają. Błędy walidacji wejścia: marki zwracają własne kody (`brand_name_invalid`, `brand_handle_invalid`), pozostałe pluginy zostawiają domyślne ciało 400 Medusy; ujednolicamy dopiero, gdy ktoś tego potrzebuje.
- Błędy API: statusy HTTP jak w sklepie, plus stały `code` (stałe w `errors.ts`, eksportowane). `MedusaError` z trzecim argumentem działa dla `UNAUTHORIZED`, `NOT_FOUND`, `INVALID_DATA`, `NOT_ALLOWED`; dla `DUPLICATE_ERROR`, `CONFLICT` i `DB_ERROR` Medusa nadpisuje `code`, więc odpowiedz wprost z trasy: `res.status(422).json({ type: 'duplicate_error', code, message })`.

## 5. Wydzielanie istniejącego modułu ze sklepu

- Model, plik migracji, nazwy klas, klucz modułu i nazwa tabeli **bez zmian** (`diff` pusty z kodem sklepu), razem z `migrations/.snapshot-<moduł>.json` w repozytorium pluginu. `medusa plugin:build` nie kopiuje snapshotów do paczki, więc oba pakiety 0.1.0 (newsletter, omnibus) wyszły bez niego; konsumenci go nie potrzebują, liczy się tylko przy `db:generate` wewnątrz pluginu (nie naprawiaj builda przy okazji). Baza sklepu i tak pomija migrację.
- Dowód na kopii bazy sklepu, zanim wydasz wersję: `createdb -T baza kopia` (albo `create database kopia template baza` przez psql), `medusa db:migrate` na kopii. Oczekiwane: „Skipped. Database is up-to-date for module.”, liczba wierszy `mikro_orm_migrations` bez zmian, żadnego `drop`. Pusta tabela w bazie deweloperskiej to słaby dowód; liczy się tabela migracji. Kopię usuń.
- Zdarzenia: usuń prefiks sklepu z nazw (`price-history.recorded`), a w sklepie zaktualizuj subskrybentów.
- Prefiks logów i tym podobne wstrzykuj opcją (`logPrefix`).
- **Middleware pluginu i sklepu się scalają**: Medusa łączy `src/api/middlewares.ts` wszystkich pluginów z plikiem sklepu i sortuje wpisy po specyficzności ścieżki, nie po pliku. Strażnik pluginu na `/store/account*` obejmuje więc także trasy, które sklep dokłada pod tą ścieżką (np. `orders`); sklep dalej wpisuje własne `authenticate(...)` i walidatory. Przy wydzielaniu usuń ze sklepu dokładnie przeniesione wpisy (te same matchery i metody), resztę zostaw.
- Trasy domeny, które zależą od innej domeny (np. `orders*` od zamówień/faktur), zostają w sklepie do kroku, który wydziela tę domenę; wspólne helpery eksportuj z pluginu (`ownOrder`, `closedRoutes`).

## 6. Testy

- **Unit** (jest `TEST_TYPE=unit`, vitest w `commerce-rules`): opcje, słowniki (scalanie, `undefined`), walidatory, czyste funkcje.
- **Moduł** (`moduleIntegrationTestRunner` z `moduleOptions`): serwis, opcje dochodzą (`getOptions()`), wyścigi przez `Promise.all`.
- **HTTP** w `apps/test-shop` (`medusaIntegrationTestRunner`, plugin z workspace): ustaw w `medusa-config.ts` test-shopa jedną opcję inną niż domyślna i sprawdź ją przez HTTP, resztę asercji rób na domyślnych. Sprawdź kody błędów (`code` w ciele), pusty sekret (401), job (logger przez `jest.spyOn`, po użyciu `mockRestore`).
- `createStore` w helperach nie jest idempotentne: wołaj raz na test.
- Postgres: `docker compose up -d` (port 55532) i zmienne z README repo. Testy HTTP wymagają `STOREFRONT_API_SECRET` (test-shop ustawia domyślny w `integration-tests/setup.js`).
- Przed PR: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`.

## 7. Changeset, PR, publikacja

1. Gałąź, commity małe (`feat(<pakiet>): …`, `docs: …`), `pnpm changeset` (wybierz pakiety i typ; wersje niezależne). Pierwsze wydanie to `0.1.0`.
2. Changeset commitujesz z PR-em; wersje podbija PR „Version packages”, który `release.yml` otwiera po scaleniu (punkt 5). Skrót przy pilnym wydaniu: `pnpm changeset version` w tej samej gałęzi i commit – wtedy publikacja idzie od razu po scaleniu. Zmiany tylko w dokumentacji nie potrzebują changesetu.
3. Sprawdzenie paczki: `pnpm pack --dry-run` w katalogu pakietu. Ma zawierać build (`.medusa/server` albo `dist`), `LICENSE`, `README.md`, `package.json` bez `catalog:` i `workspace:` (`grep` po spakowanym manifeście).
4. `gh pr create` (opis kończy się linią o Claude Code), `gh pr checks --watch`, przy zielonym CI `gh pr merge --squash --delete-branch`.
5. Po scaleniu `release.yml` otwiera albo aktualizuje PR „Version packages”; jego scalenie publikuje do GitHub Packages. `main` jest chroniony – scalenie wymaga zielonego `check`. Sprawdź w logu: `gh run list --workflow release.yml`, `gh run view <id> --log` (ma być „packages published successfully”). `npm view` wymaga tokenu z `read:packages`. Przy 502 przy merge i braku przebiegu: `workflow_dispatch`.
6. Nowy pakiet jest po publikacji prywatny: przełącz na Public w GitHubie (Org Settings → Packages musi pozwalać na pakiety publiczne; nie da się tego zrobić API).

## 8. Podpięcie w sklepie i przejście sklepu

1. Token (raz): zob. README kitu i `pnpm-monorepo.md`. Projektowy `.npmrc` sklepu ma tylko `@cloud-house:registry=https://npm.pkg.github.com`, token w `~/.npmrc` jako `${NODE_AUTH_TOKEN}`; `export NODE_AUTH_TOKEN=$(gh auth token)` przed `pnpm install`.
2. `pnpm add --save-exact @cloud-house/<pakiet>@<wersja>` (bez `^`; `pnpm link` tylko lokalnie i nigdy w commicie: `git diff` bez `link:` i `file:`).
3. `medusa-config.ts`: wpis w `plugins` z opcjami sklepu (nazwa nagłówka, `logPrefix`…), usuń moduł z `modules`.
4. Usuń ze sklepu przeniesiony kod i jego testy, jeśli kit testuje to samo w całości; testy integracji sklepu zostają. Poprawy importów (`grep` po starych ścieżkach, w tym skryptach seed i testach) wyłapie `pnpm typecheck`.
5. Weryfikacja: migracja na kopii bazy (pkt 5 wyżej), `pnpm build && pnpm typecheck && pnpm lint && pnpm test`, E2E sklepu, ręczne sprawdzenie panelu pluginu i joba.
6. Po usuwaniu tras: skasuj `apps/storefront/.next` (zob. `next-cache-metadane.md`).
7. Dokumentacja sklepu: wpis w dzienniku decyzji, a CI, Docker i hosting potrzebują `NODE_AUTH_TOKEN` z `read:packages` przy `pnpm install`.

## 9. Pakiet dla Next.js (`next-medusa`)

- **Dwa wejścia** w `exports`: `.` (bezpieczne w kodzie klienckim: błędy, `cachedInit`) i `./server` (importuje `server-only`, czyta `process.env`, `next/headers`, `next/cache`). Nie mieszaj ich: import wejścia `./server` z komponentu klienta ma paść przy buildzie.
- `server-only` i `@medusajs/js-sdk` są peerami (sklep je ma), `next` też (`^16.3.3`). Nie bundluj Next do `dist` (tsup `external`).
- Importy `next/headers` i `next/cache` w `dist` muszą mieć rozszerzenie (`next/headers.js`), inaczej zwykły Node ESM i Vitest ich nie rozwiążą (zob. `pulapki-medusa-next`, `vitest.md`). Naprawione w 0.1.2 (test `dist-resolution` w CI); sklep i tak dodaje w `vitest.config` `server.deps.inline: ['@cloud-house/next-medusa']` (inaczej `vi.mock('server-only')` nie działa na kod kitu) oraz `vi.mock('server-only')` w testach.
- Wszystko, co sklep chciałby zmienić, jest opcją fabryki (`createCartCookie({ name })`, `createRevalidateRoute({ header, secretEnv, locale, messages, logPrefix })`), a nie stałą w pakiecie. Pakiet nie zna nazw ciasteczek, nagłówków ani tagów sklepu.

## 10. Wzorce: trasa sklepu nad trasą pluginu, strony admina dostarczane przez sklep

- **Trasa sklepu wygrywa z trasą pluginu** o tej samej ścieżce (pliki `route.ts` ładowane po kolei: pluginy, na końcu projekt). Sklep, który ma własną wersję (np. `/store/brands` liczone przez swój katalog), po prostu ma własny plik trasy i nie potrzebuje opcji; opcja `storeRoute: false` służy sklepowi, który nie chce tej trasy wcale (handler woła `next()`, odpowiedź jak dla nieznanej ścieżki). Logikę trasy eksportuj osobno (`brandsStoreRoute`), żeby sklep mógł ją podpiąć w swoim pliku. Zob. `pulapki-medusa-next/references/medusa-plugin.md`.
- **Strona admina, którą ma dostarczyć sklep** (`adminDetailLinks`): plugin nie wysyła strony `/brands/:id`, bo kolidowałaby ze stroną sklepu (dwie strony pod jedną ścieżką). Zamiast tego opcja `adminDetailLinks` (domyślnie `false`) jest wystawiona przez `GET /admin/<plugin>/messages` w polu `settings`; lista w panelu pluginu pokazuje przycisk „Szczegóły” z linkiem tylko, gdy sklep ją włączył i sam dostarcza stronę pod tą ścieżką. Ta sama zasada dla każdego pluginu: plugin daje listę i stałe ścieżki, szczegóły i edycję bogatszą niż minimum robi sklep.
- Teksty domyślne pluginu są neutralne (bez ścieżek i nazw jednego sklepu); sklep nadpisuje je opcją `messages`, żeby zachować własne brzmienie.

## 11. Wydania: PR „Version packages”

Od 2026-11-12 organizacja pozwala Actions otwierać PR-y, więc obowiązuje droga z punktu 7 (changeset w PR-ze funkcji, wersje podbija bot):

1. PR funkcji z changesetem → zielony `check` → `gh pr merge --squash --delete-branch`.
2. `release.yml` otwiera (albo aktualizuje) PR „Version packages”.
3. **CI tego PR-a kończy się `action_required`**: PR otwarty przez bota (`GITHUB_TOKEN`) wymaga zatwierdzenia przebiegu przez człowieka, a wymagany `check` nie ruszy sam. **Przed zatwierdzeniem sprawdź PR**: autor to `github-actions[bot]`, gałąź `changeset-release/main`, a diff zawiera wyłącznie podbicia wersji (`package.json`), `CHANGELOG.md` i usunięte `.changeset/*.md` (`gh pr view <nr> -R cloud-house/medusa-libs --json author,headRefName,files`, `gh pr diff <nr>`). Zatwierdzenie uruchamia kod z gałęzi PR-a z dostępem do sekretów, więc cokolwiek innego w diffie zatrzymuje wydanie. Dopiero wtedy zatwierdź przebieg przez API (bez omijania ochrony `main`):

   ```sh
   gh run list -R cloud-house/medusa-libs --branch changeset-release/main -L 3   # id przebiegu
   gh api -X POST repos/cloud-house/medusa-libs/actions/runs/<id>/approve
   gh pr checks <nr> -R cloud-house/medusa-libs --watch
   gh pr merge <nr> -R cloud-house/medusa-libs --squash
   ```

4. Po scaleniu `release.yml` publikuje; sprawdź `gh run view <id> --log` („New tag:”) i `npm view @cloud-house/<pakiet> version --registry=https://npm.pkg.github.com`.
5. Zależności wewnętrzne: gdy pakiet dostaje minor, changesets podbija patch u jego dependentów w tym samym PR-ze „Version packages” (np. nowy minor `commerce-rules` daje patch `medusa-omnibus`). To oczekiwane; sklep aktualizuje też te wersje i dopisuje je do `minimumReleaseAgeExclude` w `pnpm-workspace.yaml`.
6. Zmiany tylko w dokumentacji i w `claude-plugin/` nie potrzebują changesetu.
