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
