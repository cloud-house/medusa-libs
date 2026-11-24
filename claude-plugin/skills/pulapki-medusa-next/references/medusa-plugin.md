# Medusa: budowa pluginu

## Migracje po przejściu na plugin wykonują się drugi raz
Słowa: migration, `Migration2026...`, `mikro_orm_migrations`, nazwa klasy, `db:migrate`

- **Objaw:** po przeniesieniu modułu do pluginu `medusa db:migrate` próbuje utworzyć istniejące tabele albo je usuwa.
- **Przyczyna:** Medusa uznaje migrację za wykonaną po nazwie klasy; inna nazwa = nowa migracja.
- **Rozwiązanie:** zachowaj nazwy klas migracji, klucz modułu i nazwy tabel. Zanim wydasz plugin dla działającego sklepu, uruchom `db:migrate` na kopii bazy i sprawdź, że nic się nie wykonuje i nic nie znika.

## Panel admina pluginu importuje kod hosta
Słowa: `src/admin`, tsconfig admin, import serwera, typy

- **Objaw:** build panelu pluginu pada na imporcie modułów serwera albo helperów sklepu.
- **Przyczyna:** `tsconfig` panelu jest ścisły i nie widzi kodu serwera; plugin nie może zależeć od plików hosta.
- **Rozwiązanie:** typy wspólne trzymaj w plikach-liściach bez zależności serwerowych; kod klienta API wchodzi do pluginu. Zależności panelu (React, `@tanstack/react-query`, `react-router-dom`) mają być rozwiązywalne z korzenia (zob. hoisting w `pnpm-monorepo.md`).

## Opcje pluginu a moduły pluginu
Słowa: `plugins[].options`, `moduleOptions`, `getOptions`, `configModule.plugins`, `.medusa/server/src/modules`

- **Objaw:** nie wiadomo, jak trasa, middleware albo strona panelu pluginu ma odczytać `options` z `plugins: [{ resolve, options }]` w `medusa-config.ts`; kusi czytanie `configModule.plugins` po nazwie pakietu.
- **Przyczyna:** Medusa 2.21 (`getResolvedPlugins` w `@medusajs/utils`) rejestruje każdy katalog z `.medusa/server/src/modules/*` pluginu jako moduł z `options: plugin.options`, a `mergePluginModules` dokleja je do `configModule.modules`. Serwis modułu dostaje te opcje jako drugi argument konstruktora (tak samo jak `moduleOptions` w `moduleIntegrationTestRunner`). Trasy dostają tylko `req.scope`.
- **Rozwiązanie:** serwis modułu w konstruktorze `(container, options)` zapisuje opcje z domyślnymi i wystawia `getOptions()`; trasy i middleware biorą je przez `req.scope.resolve(MODULE).getOptions()`, panel przez własną trasę admina. Fallback z `configModule.plugins` nie jest potrzebny. Dwa warunki: w `exports` pakietu musi być `"./.medusa/server/src/modules/*"` (bez tego `Cannot find module '<plugin>/.medusa/server/src/modules/<nazwa>'`), a sklep nie może mieć tego samego modułu w `modules` (wpis sklepu wygrywa i opcje pluginu przepadają). Middleware z walidatorem zależnym od opcji: zbuduj schemat w funkcji middleware (`validateAndTransformBody(schema)(req, res, next)`), bo `defineMiddlewares` to statyczna konfiguracja bez dostępu do kontenera.

## `code` w `MedusaError` znika dla części typów
Słowa: `DUPLICATE_ERROR`, `invalid_request_error`, `CONFLICT`, `DB_ERROR`, kod błędu, 422

- **Objaw:** `throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, msg, 'newsletter_already_subscribed')` daje 422, ale w odpowiedzi `code: 'invalid_request_error'`.
- **Przyczyna:** handler błędów Medusy (`getHttpResponseFromError` w `@medusajs/framework/http`) nadpisuje `code` dla `DUPLICATE_ERROR`, `CONFLICT` i `DB_ERROR`; dla `UNAUTHORIZED`, `NOT_FOUND`, `INVALID_DATA`, `NOT_ALLOWED` zostawia trzeci argument.
- **Rozwiązanie:** dla tych typów odpowiedz wprost: `res.status(422).json({ type: 'duplicate_error', code, message })`. Asercja na `code` w teście HTTP.

## Dekoratory Medusy a Biome
Słowa: `@MedusaContext`, `unsafeParameterDecoratorsEnabled`, biome

- **Objaw:** Biome zgłasza błąd parsowania na `@MedusaContext()` w parametrach serwisu.
- **Przyczyna:** parser Biome domyślnie nie przyjmuje dekoratorów parametrów.
- **Rozwiązanie:** `javascript.parser.unsafeParameterDecoratorsEnabled: true` w `biome.json`. Nie używaj `biome --unsafe` - przepisuje cudzysłowy w kluczach i psuje kod.

## Konfiguracja modułu Notification podmienia domyślny
Słowa: notification, `notification-local`, `feed`, Resend

- **Objaw:** po skonfigurowaniu własnego providera powiadomień przestaje działać import/eksport w panelu.
- **Przyczyna:** jawna konfiguracja Notification zastępuje domyślną; kanał `feed` używany przez panel traci providera.
- **Rozwiązanie:** zostaw `notification-local` na kanale `feed`. Resend SDK zwraca `{ error }` zamiast rzucać wyjątek, więc sprawdzaj wynik. Ponowna próba po `failure` dostaje nowe id powiadomienia (daj `Idempotency-Key`). React musi być zależnością uruchomieniową backendu, jeśli szablony e-mail są komponentami.

## Wersja Medusy i zakresy peer
Słowa: `peerDependencies`, `~2.21`, catalog, upgrade

- **Objaw:** plugin instaluje drugą kopię `@medusajs/framework` albo wymusza niezgodną wersję; w opublikowanym `package.json` zostaje `catalog:`.
- **Przyczyna:** wersje Medusy rozjechane między pakietami albo peerDependencies z dokładną wersją.
- **Rozwiązanie:** jedno miejsce prawdy (catalog pnpm), peery `~x.y.z`, devDependencies dokładne. Przed publikacją sprawdź `npm pack --dry-run` (brak `catalog:` i `workspace:`, jest build).

## Pozostałe drobiazgi backendu
Słowa: multer, `variant.images`, handle, polskie litery, ES2021

- Upload plików w trasie admina wymaga dodania `multer` do zależności backendu.
- `variant.images` w Medusie 2.21 zawiera też zdjęcia produktu niepowiązane z żadnym wariantem.
- Handle'e Medusy mogą zawierać polskie litery (w URL-ach są kodowane), więc porównuj po zdekodowaniu.
- Cel kompilacji backendu bywa ES2021 (brak `Array.prototype.at()`).
- Odczyt `items.quantity` w admin order read nie działa, użyj `items.detail.quantity`. Zwrot: przekaż `location_id`, bo bez niego przyjęcie w panelu się psuje; własny limit ilości liczy wysłane minus zażądane, przyjęte i odrzucone.

## `medusa plugin:build` pada bez katalogu `src/admin`
Słowa: `plugin:build`, `src/admin`, ENOENT, `.gitkeep`, plugin bez panelu

- **Objaw:** `medusa plugin:build` kończy się błędem ENOENT w pluginie, który nie ma żadnego interfejsu admina. Kolejny drobiazg: puszczenie wyjścia buildu przez `| head` zawiesza proces (EPIPE; zaobserwowane przy budowie newslettera).
- **Przyczyna:** build zawsze uruchamia bundler panelu i oczekuje katalogu `src/admin` (źródło: praca nad `@cloud-house/medusa-newsletter` i `@cloud-house/medusa-omnibus`; kod bundlera nie czytany).
- **Rozwiązanie:** pusty `src/admin/.gitkeep` wystarcza; w wyniku jest pusty `admin/index.js`, a wpis `./admin` w `exports` zostaje dla zgodności. Nie obcinaj wyjścia buildu.

## Sklep nie znajduje modułu pluginu (`exports`)
Słowa: `Cannot find module`, `.medusa/server/src/modules`, `exports`, `package.json`

- **Objaw:** po dodaniu pluginu do `plugins` start kończy się `Cannot find module '<plugin>/.medusa/server/src/modules/<nazwa>'`.
- **Przyczyna:** Medusa rozwiązuje moduły pluginu po specyfikatorze `<plugin>/.medusa/server/src/modules/<nazwa>`, a mapa `exports` w `package.json` pluginu go nie zawiera (sprawdzone usunięciem wpisu w newsletterze: wszystkie testy HTTP padły).
- **Rozwiązanie:** w `exports` jest `"./.medusa/server/src/modules/*": "./.medusa/server/src/modules/*/index.js"` (szablon pluginu Medusy ma go razem z `"./modules/*"`). Nie usuwaj go przy porządkowaniu mapy.

## Wydzielenie modułu ze sklepu: migracje, snapshot, dowód na kopii bazy
Słowa: `createdb -T`, `pg_dump`, "Skipped. Database is up-to-date", `.snapshot-<moduł>.json`, `db:generate`, `mikro_orm_migrations`

- **Objaw:** niepewność, czy sklep z danymi po przejściu na plugin nie wykona migracji drugi raz ani niczego nie skasuje; tabela w bazie deweloperskiej bywa pusta, więc liczba wierszy niczego nie dowodzi.
- **Przyczyna:** migracja jest rozpoznawana po nazwie klasy, a moduł po kluczu (zob. wpis o migracjach wyżej); plik `.snapshot-<moduł>.json` służy tylko `db:generate`, więc jego brak w paczce nie psuje `db:migrate`, ale zepsuje kolejną generację migracji (źródło: `medusa plugin:build` nie kopiuje `migrations/.snapshot-*.json`, więc oba pakiety 0.1.0, newsletter i omnibus, wyszły bez snapshotu; konsumenci go nie potrzebują, liczy się tylko przy `db:generate` wewnątrz pluginu).
- **Rozwiązanie:** przenieś model, plik migracji, nazwy klas i klucz modułu bajt w bajt (`diff` pusty) razem ze `.snapshot-<moduł>.json` (w repozytorium pluginu; build go nie dołączy do paczki, nie naprawiaj tego przy okazji). Dowód: kopia bazy (`createdb -T baza kopia`, a gdy brak hasła: `create database kopia template baza` przez psql), `medusa db:migrate` na kopii, w wyniku dla modułu „Skipped. Database is up-to-date for module.”, liczba wierszy `mikro_orm_migrations` przed i po jednakowa, liczba wierszy tabeli modułu bez zmian. Kopię usuń; prawdziwej bazy nie migruj.

## Pusty `undefined` w nadpisaniu tekstu kasuje domyślny tekst
Słowa: `resolveMessages`, `messages`, spread, `undefined`, słownik

- **Objaw:** `messages: { alreadySubscribed: undefined }` (np. z niedokończonej konfiguracji) zostawia w odpowiedzi brak tekstu zamiast tekstu domyślnego.
- **Przyczyna:** `{ ...słownik, ...nadpisania }` kopiuje też klucze o wartości `undefined`. Wystąpiło w `@cloud-house/medusa-newsletter@0.1.0`; w omnibusie poprawione (`withoutUndefined`).
- **Rozwiązanie:** przed scaleniem odfiltruj klucze `undefined` i dodaj test „ignores undefined overrides” dla `resolveMessages` i `resolveOptions`.

## Trasa sklepu w tej samej ścieżce co trasa pluginu
Słowa: `src/api/store/.../route.ts`, plugin, ta sama ścieżka, nadpisanie trasy, `storeRoute`, `next()`

- **Objaw:** plugin ma `GET /store/brands`, sklep ma własny `src/api/store/brands/route.ts`; niepewność, kto odpowiada (w `test-shop` odpowiedział sklep: `{"from":"project"}`, bez błędu przy starcie).
- **Przyczyna:** `RoutesLoader.registerRoute` zapisuje trasy w mapie `ścieżka -> metoda`, a `ApiLoader` skanuje katalogi źródeł po kolei (pluginy, na końcu projekt), więc późniejsza trasa zastępuje wcześniejszą (źródło: `@medusajs/framework` 2.21.2, `dist/http/routes-loader.js` i `router.js`; sprawdzone w `test-shop` z trasą projektu obok pluginu).
- **Rozwiązanie:** sklep nadpisuje trasę pluginu zwykłym plikiem trasy, bez opcji. Plugin, który ma być wyłączalny, wysyła plik trasy, a jego handler przy wyłączeniu wywołuje `next()` (handler trasy dostaje `next`; odpowiedź jest taka jak dla nieznanej ścieżki, 404). Samą logikę eksportuj osobno (`brandsStoreRoute`), żeby sklep mógł ją podpiąć w swoim pliku trasy bez bramki opcji. Nie można „nie rejestrować” trasy z pliku warunkowo: pliki `route.ts` ładuje skaner katalogów, bez pytania o opcje.

## Opcje pluginu nie docierają do subskrybentów, workflow i tras
Słowa: `plugins[].options`, subscriber, workflow, `req.scope`, moduł-trzymacz, `getOptions`

- **Objaw:** plugin ma opcje (`paths`, `locale`, haki), ale kod spoza modułu widzi tylko domyślne albo nic.
- **Przyczyna:** Medusa 2.21 przekazuje `options` tylko modułom pluginu; subskrybent dostaje surowe `pluginOptions`, a workflow, kroki i trasy nie dostają nic.
- **Rozwiązanie:** plugin bez tabel rejestruje mały moduł bez modeli (`MedusaService({})`, `resolveOptions` w konstruktorze, `getOptions()`) i jeden helper `xOptions(container)`; migracji i tabel nie przybywa (dowód: `db:migrate` na kopii bazy „Skipped”, w buildzie brak `migrations/` i `models/`). Sklep nie wpisuje tego modułu w `modules`. Haki sklepu (`resolveContact`, `onAccountDeleted`) to funkcje w opcjach; błąd haka usuwania przerywa usuwanie, a dotychczas wymazane dane nie wracają.

## Layout maila z React Email: zgodność ze sklepem sprawdź snapshotem
Słowa: `react-email`, `<!-- -->`, snapshot HTML, `NBSP`, layout

- **Objaw:** po przeniesieniu layoutu do kitu HTML maili różni się od dotychczasowego (inne odstępy, komentarze, link w stopce).
- **Przyczyna:** `react-dom` wstawia `<!-- -->` między sąsiednimi węzłami tekstowymi i React Email je zostawia, więc zmiana `{a} {b}` na szablon `` {`${a} ${b}`} `` zmienia bajty; do tego twarda spacja w telefonie (U+00A0) i style budowane z motywu.
- **Rozwiązanie:** zanim ruszysz sklep, dodaj w nim test parytetu z snapshotami HTML wszystkich maili (znormalizowanymi), przenieś layout, uruchom ten sam test bez zmiany snapshotów. Zachowaj podział węzłów tekstu jak w oryginalnym JSX.

## Implementer w subagencie zostaje na gałęzi
Słowa: `detached HEAD`, `git checkout`, subagent, wydanie, `npm view`, `.medusa/server/src`

- **Objaw:** pakiet wyszedł do rejestru bez części plików (0.1.0 `medusa-accounts` bez tras i middleware).
- **Przyczyna:** implementer pracował na odłączonym HEAD (albo nie na gałęzi zadania), commity nie trafiły do gałęzi, która została scalona i wydana.
- **Rozwiązanie:** przed każdym commitem `git branch --show-current` (ma być gałąź zadania); w poleceniu dla implementera podaj gałąź i zakaz `git checkout <sha>`. Przed uznaniem wydania za dobre: `npm view @cloud-house/<pakiet>@<wersja> --registry=https://npm.pkg.github.com`, a po instalacji w sklepie sprawdź zawartość `node_modules/@cloud-house/<pakiet>/.medusa/server/src` (trasy, middleware, opcje). Niepełną wersję zastąp nową; nie nadpisuj opublikowanej.

## Katalogi `.superpowers` w repozytorium
Słowa: `.superpowers`, briefy, raporty, `git status`, lint

- **Objaw:** briefy i raporty zadań (`.superpowers/sdd/...`) trafiają do commitów albo do lintu.
- **Przyczyna:** to robocze notatki przepływu pracy z agentami, nie część kodu.
- **Rozwiązanie:** `.superpowers` w `.gitignore` (lub w `.git/info/exclude`) i poza zakresem Biome; nie dodawaj ich przez `git add -A` bez sprawdzenia `git status`.

## Wydanie nieodwracalne: sprawdź sklep na tarballu, zanim wydasz
Słowa: `pnpm pack`, tarball, `file:`, parytet, wydanie, rejestr

- **Objaw:** błąd przeniesienia (inny payload, inny mail, inna trasa) wychodzi dopiero po wydaniu, gdy wersji nie da się wycofać.
- **Przyczyna:** testy sklepu na pakiecie z rejestru są możliwe dopiero po publikacji.
- **Rozwiązanie:** `pnpm build && pnpm pack` w pakiecie, w sklepie `"@cloud-house/<pakiet>": "file:<ścieżka>.tgz"`, pełne testy (snapshoty maili i payloadów bez zmian, HTTP, `db:migrate` na kopii bazy), dopiero potem wydanie i przypięcie wersji z rejestru (wpis w `minimumReleaseAgeExclude`, odświeżony lockfile).

## `medusa plugin:build` bez katalogu `src/admin`
Słowa: `plugin:build`, `__admin-extensions__.js`, ENOENT, `.gitkeep`

- **Objaw:** `medusa plugin:build` kończy się `ENOENT … src/admin/__admin-extensions__.js` w pluginie bez panelu admina.
- **Przyczyna:** budowanie rozszerzeń admina zawsze zakłada katalog `src/admin`.
- **Rozwiązanie:** pusty `src/admin/.gitkeep` (tak ma `medusa-accounts`).

## Test HTTP w test-shopie: zamówienie klienta zmienia właściciela
Słowa: `placeOrder`, `account_customer_id`, `ownOrder`, `order.placed`, test-shop

- **Objaw:** trasa konta (`ownOrder`) zwraca 404 dla zamówienia, które test założył klientowi, choć tuż po `placeOrder` `customer_id` się zgadza.
- **Przyczyna:** subskrybent `order.placed` pluginu `medusa-accounts` przepisuje zamówienie na innego klienta (rekord gościa), gdy koszyk nie wskazuje konta.
- **Rozwiązanie:** `placeOrder(..., { customerId, cartMetadata: { account_customer_id: customerId } })`, jak w `account-orders-link.spec`.

## Jest: „Converting circular structure to JSON” zamiast błędu asercji
Słowa: `circular`, `AxiosError`, `jest-worker`, `--runInBand`, `api.post`

- **Objaw:** pakiet HTTP w test-shopie kończy się `Jest worker encountered 4 child process exceptions` i zerem testów.
- **Przyczyna:** test rzucił `AxiosError` (żądanie z kodem 4xx bez `send(...)`), a worker nie umie przesłać go do rodzica.
- **Rozwiązanie:** `TEST_TYPE=integration:http NODE_OPTIONS="--experimental-vm-modules --max-old-space-size=8192" pnpm exec jest --runInBand <plik>` pokazuje prawdziwy błąd; w testach oczekiwany błąd łap przez `send(...)`.
