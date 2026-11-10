# Medusa: błędy HTTP, middleware, konta

## Kod HTTP nie zgadza się z `MedusaError`
Słowa: `MedusaError.Types`, status, 409, `CONFLICT`, `DUPLICATE_ERROR`, `NOT_ALLOWED`, `INVALID_DATA`

- **Objaw:** rzucasz `MedusaError` i klient dostaje inny status niż oczekiwany; komunikat jest podmieniony na ogólny.
- **Przyczyna:** handler błędów Medusy mapuje typy na statusy i dla niektórych podmienia treść: `CONFLICT` (409) traci swój komunikat; `DUPLICATE_ERROR` daje 422; `NOT_ALLOWED` daje 400 (komunikat zostaje); `NOT_FOUND` 404; `INVALID_DATA` 400. Naruszenie unikalności w bazie jest mapowane na `INVALID_DATA` z tekstem "... already exists.", nie na `DUPLICATE_ERROR`.
- **Rozwiązanie:** wybieraj typ pod docelowy status, a zachowanie przypnij testem HTTP. Ustal też stały `code` błędu w trzecim argumencie `MedusaError`, żeby storefront tłumaczył komunikat po swojej stronie.

## Middleware bez `method` to prefiks, nie dokładna trasa
Słowa: `src/api/middlewares.ts`, `matcher`, `closedRoutes`, Express, `baseUrl`

- **Objaw:** guard zadeklarowany dla `/store/x` łapie też `/store/x/y`; "zamknięta" trasa Medusy daje się ominąć innym adresem.
- **Przyczyna:** wpisy bez `method` są prefiksami (`app.use`), a Express dopasowuje po `req.baseUrl + req.path`.
- **Rozwiązanie:** wewnątrz middleware sprawdzaj dokładną ścieżkę. Natywne trasy, których nie chcesz (np. `POST /store/returns`, rejestracja klienta), zamykaj jawnie i przetestuj obejścia.

## Konta klientów: JWT nie wygasa, rejestracja przyjmuje każdy e-mail
Słowa: `jwtExpiresIn`, `/auth/token/refresh`, `/auth/session`, `emailpass`, `verification`, `reset-password`

- **Objaw:** po zmianie hasła/wylogowaniu stary token nadal działa; `/auth/customer/emailpass/register` i `POST /store/customers` tworzą konto na cudzy adres bez potwierdzenia; `reset-password` "failuje" w SDK.
- **Przyczyna:** `jwtExpiresIn` jest globalny (domyślnie 1 dzień), a JWT nigdy nie są unieważniane; refresh wystawia nowy `iat`. Natywna rejestracja nie weryfikuje e-maila. `reset-password` odpowiada 201 z tekstem `Created`, nie JSON-em. `deleteCustomersWorkflow` jest miękkie.
- **Rozwiązanie:** zapisz `sessions_valid_from` w metadata klienta i sprawdzaj w guardzie sesji; zamknij `/auth/token/refresh` i `/auth/session` dla tokenów klientów; własne trasy rejestracji z potwierdzeniem; w `js-sdk` wołaj `reset-password` z `accept: text/plain`; dane osobowe przy usuwaniu konta kasuj sam (i otwarte koszyki). Własny moduł Auth musi ponownie zadeklarować `emailpass` i klucz MFA. TTL kodów weryfikacji ustawia opcja `verification.providers[{id:'token', options:{ttl_seconds}}]`; provider `token` zapisuje `sha256(code)` w hex.

## Gościnny koszyk wpada na konto istniejącego klienta
Słowa: `findOrCreateCustomerStep`, guest cart, `order.placed`, e-mail

- **Objaw:** zamówienie gościa pojawia się na koncie zarejestrowanego klienta o tym samym e-mailu.
- **Przyczyna:** `findOrCreateCustomerStep` dołącza koszyk gościa do istniejącego zarejestrowanego klienta po e-mailu.
- **Rozwiązanie:** zamówienia gości łącz z kontem dopiero po potwierdzeniu e-maila; regułę własności koszyka rozstrzygaj w subskrybencie `order.placed`. Testy zamówień konta wymagają przypięcia koszyka do klienta, inaczej to zamówienie gościa (404 na trasach konta).

## `GET /store/orders/:id` jest publiczne
Słowa: order, guest, lookup, 404

- **Objaw:** każdy z identyfikatorem zamówienia widzi je bez logowania.
- **Przyczyna:** natywna trasa jest publiczna po id.
- **Rozwiązanie:** dla gości własna trasa wyszukiwania (numer + e-mail) ze stałą, identyczną odpowiedzią 404 dla złego numeru i złego e-maila.

## `@medusajs/js-sdk`: `FetchError` bez treści odpowiedzi
Słowa: `FetchError`, js-sdk, body, message, status

- **Objaw:** w `catch` nie ma pola z treścią błędu API.
- **Przyczyna:** `FetchError` zachowuje tylko `message` i `status`.
- **Rozwiązanie:** kod błędu przekazuj w `message` albo użyj własnego `fetch` dla tras, na których potrzebujesz `code`.

## Serwer deweloperski: nowa trasa niewidoczna, proces zostaje
Słowa: `medusa develop`, nowy plik trasy, 9000, proces potomny

- **Objaw:** nowo dodany plik trasy zwraca 404; po zabiciu `medusa develop` port nadal zajęty.
- **Przyczyna:** `medusa develop` nie zbiera nowo dodanego pliku trasy, a po zabiciu rodzica zostaje proces potomny na porcie (przyczyny nie zbadano). W worktree serwer raz nie zrestartował się po zmianach backendu (log miał jedno "Server is ready").
- **Rozwiązanie:** po dodaniu trasy lub zmianach backendu restartuj serwer; zabij proces potomny po porcie (`lsof -ti :PORT | xargs kill`).
