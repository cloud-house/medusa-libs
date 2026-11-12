# Next.js 16: cache, metadane, nawigacja

## Stary kształt danych w cache po zmianie typu
Słowa: `unstable_cache`, `fetch` cache, `generateCacheKey`, klucz cache, 500 po deployu, wersja widoku

- **Objaw:** po wdrożeniu albo merge'u pierwsze wejście na stronę zwraca 500 albo pusty element (brakujące pole), po godzinie samo przechodzi.
- **Przyczyna:** klucz cache `fetch` w Next 16.3 to skrót z URL, metody, nagłówków, treści i opcji plus stały prefiks, bez wersji kodu. `unstable_cache` z kluczem stałym (np. `['layout']`) też. Cache potrafi zwrócić obiekt ze starego kształtu.
- **Rozwiązanie:** wszystkie odczyty danych idą przez jeden wrapper z numerem wersji w kluczu (np. `cms-view-v{N}`, `catalog-api-v{N}`) i podbijaj numer przy każdej zmianie kształtu. Dla pewności: test z odciskiem domyślnych obiektów i reguła lintera zakazująca bezpośredniego `unstable_cache`. Dane z nowym polem scalaj z domyślnymi po odczycie z cache (inaczej pusty tekst).

## Odświeżanie tagów przychodzi po odpowiedzi
Słowa: `revalidateTag`, webhook, revalidate, E2E retry

- **Objaw:** test E2E po zapisie w panelu widzi jeszcze starą stronę.
- **Przyczyna:** `revalidateTag` wywołane z innego procesu jest stosowane tuż po odpowiedzi.
- **Rozwiązanie:** w E2E ponawiaj odczyt (`expect.poll`/retry). Skrypt seedujący działa poza Next, więc po seedzie wywołaj endpoint rewalidacji ręcznie.

## Metadane: `openGraph` strony zastępuje cały rodzica
Słowa: `generateMetadata`, `openGraph`, `opengraph-image`, `metadataBase`, canonical

- **Objaw:** podstrona traci obraz OG albo pola OG z layoutu; canonical wskazuje `localhost`; budowa produkcyjna pada.
- **Przyczyna:** własne `openGraph` strony zastępuje obiekt rodzica w całości; plik `opengraph-image` działa tylko na swojej warstwie. Relatywny canonical dziedziczy prefiks ścieżki z `metadataBase`; bez `metadataBase` rozwiązuje się do localhost. Layout wywołujący `siteUrl()` na poziomie modułu wymaga zmiennej `SITE_URL` przy `next build`.
- **Rozwiązanie:** wspólna funkcja `socialMetadata` zawsze podaje obraz OG jawnie; canonical składaj przez `path.posix.join`; ustaw `SITE_URL` w buildzie. Nowe segmenty najwyższego poziomu i pliki metadanych (`icon`, `apple-icon`, `opengraph-image`) dopisz do listy zastrzeżonych slugów stron.

## `ImageResponse` nie czyta woff2
Słowa: `ImageResponse`, satori, font, `next/font`, ttf

- **Objaw:** generowany obraz OG/ikona ma domyślną czcionkę albo pada przy ładowaniu fontu.
- **Przyczyna:** satori nie czyta woff2 z `next/font`.
- **Rozwiązanie:** dołącz plik TTF do repo (z licencją) i wczytaj go w trasie. Trasy ikon/OG da się testować jednostkowo w Node.

## Przekierowanie przed 404 i pętle
Słowa: `permanentRedirect`, `notFound`, 308, handle history, `/[slug]`

- **Objaw:** zmiana adresu daje 404 zamiast 308 albo pętlę przekierowań; `/[slug]` łapie każdy adres jednosegmentowy.
- **Przyczyna:** `permanentRedirect` musi poprzedzać `notFound()`; cel przekierowania musi istnieć. Trasa `/[slug]` bez własnej obsługi 404 daje zły tytuł.
- **Rozwiązanie:** przekierowuj tylko, gdy cel rozwiązuje się w sklepie; strażnik pętli; własny tytuł 404 w trasie. Testuj 308 end to end.

## `redirect()` w akcji serwerowej odrzuca promise
Słowa: server action, `redirect`, `unstable_rethrow`, hash

- **Objaw:** wywołanie akcji z klienta kończy się odrzuconym promise zamiast przejścia.
- **Przyczyna:** `redirect()` rzuca wyjątek specjalny. `redirect()` zachowuje `#hash`.
- **Rozwiązanie:** w `catch` użyj `unstable_rethrow(err)` przed obsługą błędu. Ustawienie ciasteczka w akcji serwerowej powoduje ponowne wyrenderowanie strony/layoutu.

## Historia przeglądarki i `pushState`
Słowa: `history.pushState`, `replaceState`, `__NA`, Back, popstate

- **Objaw:** przycisk Wstecz przywraca stronę ze starymi propsami; ręczne `pushState` ignoruje synchronizację URL Next.
- **Przyczyna:** Next 16 łata `pushState`/`replaceState` i kopiuje własne pola (`__NA`, drzewo) do przekazanego obiektu; wpis bez `__NA` powoduje przeładowanie na popstate; Safari ogranicza liczbę `replaceState` w krótkim czasie.
- **Rozwiązanie:** przekazuj świeży obiekt stanu, stan trzymaj w URL i czytaj go przy montowaniu; zmiany częste (np. waga w polu liczbowym) zatwierdzaj z opóźnieniem.

## Nagłówek `x-forwarded-for` nie jest zaufany
Słowa: `x-forwarded-for`, rate limit, proxy, `TRUSTED_PROXY_HOPS`

- **Objaw:** limit zapytań da się obejść własnym nagłówkiem.
- **Przyczyna:** Next 16 zachowuje nagłówek wysłany przez klienta (dopisuje tylko `??=`).
- **Rozwiązanie:** nie ufaj pierwszemu wpisowi; klucz limitu bierz od prawej według liczby zaufanych proxy.

## Dev server: Turbopack i `next/image`
Słowa: Turbopack, `module factory is not available`, stale routes, `dangerouslyAllowLocalIP`, 127.0.0.1

- **Objaw:** po wielu edycjach dev serwer zwraca 500 ("Module ... was instantiated because it was required from ..."), nowe trasy dają 404, strony 404 wiszą, E2E są niestabilne.
- **Przyczyna:** Turbopack trzyma nieaktualny stan po `git checkout` i wielu edycjach HMR; nieaktualny `.next/dev` psuje strony 404.
- **Rozwiązanie:** restart serwera przed pełnym E2E; usuń `.next/dev`. Obrazy z localhost wymagają `dangerouslyAllowLocalIP` (tylko dev). Narzędzia deweloperskie Next serwują się tylko na 127.0.0.1 (localhost przez IPv6 nie działa). Pomiary produkcyjne lokalnie wymagają `IMAGES_ALLOW_LOCAL_IP=true` przy `next build` i `next start`, nigdy na produkcji.

## Drobne zmiany API Next 16
Słowa: `priority`, `next/image`, `fetchPriority`, error boundary `retry`

- `priority` na `next/image` jest przestarzałe i tylko dodaje link preload; dla LCP użyj `loading="eager"` i `fetchPriority="high"`.
- Granice błędów dostają `retry`.
- `content-visibility: auto` (leniwe sekcje): używaj `contain-intrinsic-block-size` (jedna wartość w `contain-intrinsic-size` ustawia też szerokość), szacunek wysokości musi być bliski prawdziwej (inaczej skoki układu fałszują testy kontrastu), a wypełnienie `contain: paint` przycina zewnętrzne obramowanie fokusu (użyj `ring-inset`).

## `next build` pada po usunięciu tras
Słowa: `.next/dev/types`, `validator.ts`, usunięte trasy, typecheck, build

- **Objaw:** `next build` kończy się błędem typów w `.next/dev/types/validator.ts`, który odwołuje się do tras, których już nie ma w kodzie.
- **Przyczyna:** gitignorowany, wygenerowany katalog `.next/dev/types` zostaje po poprzednim `next dev` i opisuje stare trasy (źródło: usunięcie tras CMS w pierwszym sklepie).
- **Rozwiązanie:** usuń `apps/storefront/.next` i zbuduj od nowa.
