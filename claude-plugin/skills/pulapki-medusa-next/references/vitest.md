# Vitest

## Pierwsze uruchomienie przeładowuje się i testy wiszą
Słowa: `optimizeDeps`, `new dependencies optimized`, `.vite`, `sharp`, browser mode, duplikat Reacta, "Invalid hook call"

- **Objaw:** świeży checkout lub worktree: testy browser mode wiszą godzinami albo padają na "Invalid hook call", w logu jest "new dependencies optimized: ...", a po drugim uruchomieniu jest zielono.
- **Przyczyna:** Vite przy pierwszym uruchomieniu odkrywa zależności w trakcie i przeładowuje stronę. Skanuje też importy modułów zamockowanych przez `vi.mock`, więc ciągnie ciężkie pakiety (np. `sharp`, CMS), które optymalizuje w trakcie przebiegu.
- **Rozwiązanie:** nowe zależności UI dopisz do `optimizeDeps.include` (`next/image` też), a ciężkie pakiety serwerowe do `optimizeDeps.exclude`. Przy nawrocie szukaj w logu "new dependencies optimized". Powtórz bieg przed szukaniem winy w kodzie.

## `beforeEach` zwraca mocka, więc jest teardownem
Słowa: `beforeEach`, `mockReset`, teardown, strzałka

- **Objaw:** test pada po zakończeniu, bo odrzucony mock jest traktowany jak błąd.
- **Przyczyna:** `beforeEach(() => mock.mockReset())` zwraca mocka, a Vitest wykonuje zwróconą funkcję jako teardown.
- **Rozwiązanie:** ciało blokowe: `beforeEach(() => { mock.mockReset() })`.

## Testy z timerami i zaległe zapisy
Słowa: timer, `saveTimeoutMs`, leaked, wycofanie zgody, countdown

- **Objaw:** test pada przez efekt poprzedniego testu w tym samym pliku (np. wyczyszczone ciasteczka), a pojedynczo jest zielony.
- **Przyczyna:** zawieszony zapis z długim domyślnym limitem (1,5 s) kończy się w następnym teście; ciasteczka i storage są wspólne dla strony przeglądarki w trybie browser.
- **Rozwiązanie:** w testach podawaj krótki limit i czekaj na zakończenie operacji; mocki rozwiązuj ręcznie; odliczania w testach nie krótsze niż 1,5 s (pełny równoległy przebieg wydłuża krótkie timery).

## Elementy `sticky` i IntersectionObserver
Słowa: `lg:sticky`, IntersectionObserver, `<legend>`, harness

- **Objaw:** pasek sticky nie jest widoczny w następnym teście tego samego pliku; element `lg:sticky` nigdy nie opuszcza viewportu.
- **Przyczyna:** po kliknięciu wewnątrz paska stan IntersectionObserver zostaje; sticky potrzebuje własnego kontenera przewijania; `<legend>` przesuwa absolutnie pozycjonowane rodzeństwo.
- **Rozwiązanie:** testy ruszające pasek umieść na końcu pliku; daj elementowi własny kontener; w polach z `<fieldset>` pamiętaj, że `<legend>` przesuwa pozycjonowane absolutnie rodzeństwo poniżej.

## Wersja React i ostrzeżenia
Słowa: React, "Encountered a script tag", canary

- **Objaw:** ostrzeżenie o tagu `<script>` w komponencie widać w Next, ale nie w Vitest.
- **Przyczyna:** stabilny React w Vitest nie ma tego ostrzeżenia (jest w canary dołączanym do Next).
- **Rozwiązanie:** sprawdzaj to w E2E, nie w teście jednostkowym.

## Pakiet z `next/headers` bez rozszerzenia nie ładuje się w Vitest
Słowa: `next/headers`, `next/cache`, `server.deps.inline`, `@cloud-house/next-medusa`, `server-only`, `ERR_MODULE_NOT_FOUND`

- **Objaw:** test jednostkowy storefrontu, który importuje `@cloud-house/next-medusa/server`, pada na rozwiązaniu `next/headers` albo `next/cache`; w Next (bundler) działa.
- **Przyczyna:** `dist/server.js` pakietu (wersje 0.1.0 i 0.1.1) importuje `next/headers` i `next/cache` bez `.js`; Vitest zostawia pakiety z `node_modules` jako zewnętrzne i ładuje je zwykłym Node ESM, który nie dopisuje rozszerzeń (źródło: pierwsze przejście sklepu na pakiet, krok 2 kitu). **Naprawione w `@cloud-house/next-medusa` 0.1.2** (źródło importuje `next/headers.js` i `next/cache.js`; test `dist-resolution` pilnuje tego w CI).
- **Rozwiązanie:** od 0.1.2 nic nie trzeba robić poza `vi.mock('server-only')` w testach modułów z wejścia `/server`. Dla wersji 0.1.0–0.1.1: w `vitest.config` projektu jednostkowego `test.server.deps.inline: ['@cloud-house/next-medusa']` (pakiet przechodzi przez transformer Vite), a w testach modułów, które importują wejście `/server`, `vi.mock('server-only')`.
