# Medusa: testy (jest, runnery integracyjne)

## Testy backendu zapisują do bazy deweloperskiej
Słowa: `loadEnv('test')`, `.env.test`, baza dev, test-env

- **Objaw:** `pnpm test` przy działającym `pnpm dev` zmienia dane deweloperskie (np. archiwizuje prawdziwy dokument treści, wrzuca pliki do dev bucketu).
- **Przyczyna:** `loadEnv('test', ...)` w Medusie czyta także zwykły `.env`, więc testy dostają adresy bazy i usług z dev.
- **Rozwiązanie:** w konfiguracji testów czytaj wyłącznie `.env.test` (własny loader zamiast `loadEnv`) i dodaj test strażnik, który pada, gdy zmienne wskazują na bazę dev. Nigdy nie rób mutation testing na współdzielonej bazie dev.

## OOM w długim przebiegu testów HTTP
Słowa: `heap out of memory`, `runInBand`, `maxWorkers`, `max-old-space-size`, seed timeout

- **Objaw:** po kilkudziesięciu suitach `medusaIntegrationTestRunner` pada na `JavaScript heap out of memory`, a seed w kolejnym teście kończy się timeoutem.
- **Przyczyna:** wszystkie suity w jednym procesie trzymają pamięć (aplikacja Medusy startuje w każdym).
- **Rozwiązanie:** `NODE_OPTIONS=--max-old-space-size=8192` oraz jest z `--maxWorkers=1 --workerIdleMemoryLimit=3GB` (worker jest restartowany po przekroczeniu limitu). Szablon Medusy używa też `--experimental-vm-modules` i `--forceExit`; `--forceExit` jest potrzebny, bo otwarte połączenia (Postgres, Redis) potrafią zawiesić koniec przebiegu.

## `53300 too many clients already` i "Timeout acquiring a connection"
Słowa: Postgres, 53300, knex, pool, flaky

- **Objaw:** losowe testy padają na `sorry, too many clients already`, `Timeout acquiring a connection` albo `Connection ended unexpectedly` w `beforeAll`; przechodzą przy ponownym uruchomieniu.
- **Przyczyna:** każdy runner tworzy własną bazę i pulę połączeń. Równolegle działające dev serwery, inne worktree albo E2E dokładają kolejne połączenia do tego samego Postgresa. Start serwerów dev w trakcie testów HTTP daje timeout puli knex.
- **Rozwiązanie:** zatrzymaj nieużywane serwery dev, uruchamiaj specyfikacje HTTP pojedynczo (`--runInBand` / jeden worker), a przed szukaniem błędu w kodzie puść padnięty plik jeszcze raz. Zwiększ `max_connections` Postgresa testowego, jeśli to się powtarza.

## Flaky seed: wyścig przy tworzeniu powiązań
Słowa: seed, duplicate link, `ensureBoardCategory`, flaky

- **Objaw:** jedna suita pada w setupie na duplikacie powiązania (produkt-kategoria), po uruchomieniu osobno przechodzi.
- **Przyczyna:** helpery seedujące wołane równolegle (`Promise.all`) tworzą to samo powiązanie dwa razy; unikalność egzekwuje baza.
- **Rozwiązanie:** helper seedujący ma być idempotentny (sprawdź istnienie przed utworzeniem) i wołany sekwencyjnie. Nie "naprawiaj" retry'em w teście.

## Szpiegowanie serwisów modułu nie działa
Słowa: `jest.spyOn`, `moduleIntegrationTestRunner`, proxy, `container.resolve`

- **Objaw:** `jest.spyOn(service, 'metoda')` w teście modułu nie przechwytuje wywołań; a w testach HTTP `jest.spyOn(container.resolve(Modules.AUTH), ...)` zmienia zachowanie tras.
- **Przyczyna:** serwis z `moduleIntegrationTestRunner` to proxy; w testach HTTP kontener jest współdzielony z aplikacją, więc spy działa globalnie.
- **Rozwiązanie:** wyścigi testuj przez `Promise.all` na prawdziwym serwisie, a wycofanie transakcji przez niepoprawny wiersz. W testach HTTP po użyciu spy zawsze `mockRestore()`.

## Joby i subskrybenci uruchamiają się w testach
Słowa: scheduled job, NODE_ENV, `process-*`, sweep

- **Objaw:** w testach HTTP job cykliczny albo subskrybent wykonuje się w tle i miesza dane.
- **Przyczyna:** Medusa rejestruje joby także w testowej aplikacji.
- **Rozwiązanie:** job wychodzi wcześnie przy `NODE_ENV === 'test'`, a logikę trzymaj w osobnej funkcji (np. `sweepX(container, now)`), którą test woła jawnie ze sztywnym `now`.

## Typy rozjeżdżają się zależnie od `.medusa/types`
Słowa: `tsc`, `query.graph`, `.medusa/types`, typecheck

- **Objaw:** typecheck przechodzi bez katalogu `.medusa/types`, a po uruchomieniu `medusa develop` pojawiają się błędy w wynikach `query.graph` (albo odwrotnie).
- **Przyczyna:** `medusa develop` generuje typy zapytań, które zaostrzają wyniki.
- **Rozwiązanie:** sprawdzaj typecheck w obu stanach (z katalogiem i bez). Wyniki `query.graph` typuj jawnie; przy nieznanych filtrach rzutuj (`as never`, wyniki `as unknown as T`).
