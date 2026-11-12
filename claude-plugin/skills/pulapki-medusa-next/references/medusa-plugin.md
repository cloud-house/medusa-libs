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

- **Objaw:** `throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, msg, 'already_subscribed')` daje 422, ale w odpowiedzi `code: 'invalid_request_error'`.
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

- **Objaw:** `medusa plugin:build` kończy się błędem ENOENT w pluginie, który nie ma żadnego interfejsu admina. Kolejny drobiazg: puszczenie wyjścia buildu przez `| head` zawiesza proces (EPIPE).
- **Przyczyna:** build zawsze uruchamia bundler panelu i oczekuje katalogu `src/admin` (źródło: raport z budowy `@cloud-house/medusa-omnibus`, krok 1 kitu; kod bundlera nie czytany).
- **Rozwiązanie:** pusty `src/admin/.gitkeep` wystarcza; w wyniku jest pusty `admin/index.js`, a wpis `./admin` w `exports` zostaje dla zgodności. Nie obcinaj wyjścia buildu.

## Sklep nie znajduje modułu pluginu (`exports`)
Słowa: `Cannot find module`, `.medusa/server/src/modules`, `exports`, `package.json`

- **Objaw:** po dodaniu pluginu do `plugins` start kończy się `Cannot find module '<plugin>/.medusa/server/src/modules/<nazwa>'`.
- **Przyczyna:** Medusa rozwiązuje moduły pluginu po specyfikatorze `<plugin>/.medusa/server/src/modules/<nazwa>`, a mapa `exports` w `package.json` pluginu go nie zawiera (sprawdzone usunięciem wpisu w newsletterze: wszystkie testy HTTP padły).
- **Rozwiązanie:** w `exports` jest `"./.medusa/server/src/modules/*": "./.medusa/server/src/modules/*/index.js"` (szablon pluginu Medusy ma go razem z `"./modules/*"`). Nie usuwaj go przy porządkowaniu mapy.

## Wydzielenie modułu ze sklepu: migracje, snapshot, dowód na kopii bazy
Słowa: `createdb -T`, `pg_dump`, "Skipped. Database is up-to-date", `.snapshot-<moduł>.json`, `db:generate`, `mikro_orm_migrations`

- **Objaw:** niepewność, czy sklep z danymi po przejściu na plugin nie wykona migracji drugi raz ani niczego nie skasuje; tabela w bazie deweloperskiej bywa pusta, więc liczba wierszy niczego nie dowodzi.
- **Przyczyna:** migracja jest rozpoznawana po nazwie klasy, a moduł po kluczu (zob. wpis o migracjach wyżej); plik `.snapshot-<moduł>.json` służy tylko `db:generate`, więc jego brak w paczce nie psuje `db:migrate`, ale zepsuje kolejną generację migracji (źródło: newsletter 0.1.0 wyszedł bez snapshotu).
- **Rozwiązanie:** przenieś model, plik migracji, nazwy klas i klucz modułu bajt w bajt (`diff` pusty) razem ze `.snapshot-<moduł>.json`. Dowód: kopia bazy (`createdb -T baza kopia`, a gdy brak hasła: `create database kopia template baza` przez psql), `medusa db:migrate` na kopii, w wyniku dla modułu „Skipped. Database is up-to-date for module.”, liczba wierszy `mikro_orm_migrations` przed i po jednakowa, liczba wierszy tabeli modułu bez zmian. Kopię usuń; prawdziwej bazy nie migruj.

## Pusty `undefined` w nadpisaniu tekstu kasuje domyślny tekst
Słowa: `resolveMessages`, `messages`, spread, `undefined`, słownik

- **Objaw:** `messages: { alreadySubscribed: undefined }` (np. z niedokończonej konfiguracji) zostawia w odpowiedzi brak tekstu zamiast tekstu domyślnego.
- **Przyczyna:** `{ ...słownik, ...nadpisania }` kopiuje też klucze o wartości `undefined`. Wystąpiło w `@cloud-house/medusa-newsletter@0.1.0`; w omnibusie poprawione (`withoutUndefined`).
- **Rozwiązanie:** przed scaleniem odfiltruj klucze `undefined` i dodaj test „ignores undefined overrides” dla `resolveMessages` i `resolveOptions`.
