# Playwright / E2E

## Nazwa dostępna jest podciągiem innej
Słowa: `getByRole`, `getByLabel`, `exact: true`, strict mode violation

- **Objaw:** `strict mode violation` (kilka dopasowań), np. pole "E-mail" pasuje także do pola w stopce; `getByRole('button', { name })` łapie dwa przyciski.
- **Przyczyna:** dopasowanie nazwy jest domyślnie podciągiem, bez rozróżniania wielkości liter. To samo w `vitest-browser`.
- **Rozwiązanie:** `{ exact: true }`. Anons trasy Next ma `role=alert`; po `<summary>` nie wyszukasz roli `button`, otwórz `getByText(tytuł, { exact: true })`.

## Klik w element `aria-disabled`
Słowa: `aria-disabled`, `force`, click timeout

- **Objaw:** `click()` wisi i kończy się timeoutem na pozornie widocznym przycisku.
- **Przyczyna:** Playwright czeka, aż element będzie "enabled", a `aria-disabled` tego nie spełnia.
- **Rozwiązanie:** `click({ force: true })` w teście, który celowo bada stan zablokowany.

## Test przechodzi "w próżni"
Słowa: vacuous test, pusty zbiór, `aria-labelledby`

- **Objaw:** test fokusu/dostępności jest zielony, choć nic nie sprawdza.
- **Przyczyna:** selektor nie znalazł elementów (np. baner ma `aria-labelledby`, a szukano `aria-label`), pętla po pustej liście.
- **Rozwiązanie:** dodaj asercję, że odwiedzono więcej niż N elementów, i zawsze pokaż nowy test na czerwono przed poprawką.

## Za dużo testów albo zły filtr
Słowa: `playwright test nazwa`, filtr, cały zestaw

- **Objaw:** `playwright test quiz` uruchamia cały pakiet.
- **Przyczyna:** nieprecyzyjny filtr (nazwa dopasowana jako wyrażenie do ścieżek) nie zawęził zestawu; łatwo tego nie zauważyć.
- **Rozwiązanie:** podaj pełną ścieżkę pliku, a przed długim przebiegiem sprawdź `--list`.

## Stan współdzielony i obciążenie
Słowa: workers, flaky, rerun, `--last-failed`, rezerwacje magazynowe

- **Objaw:** pełne E2E na zimnych lub zajętych serwerach daje przypadkowe błędy (timeouty nawigacji, `ECONNRESET`, toasty); po kilku przebiegach brakuje towaru w testowych produktach.
- **Przyczyna:** równoległe workery na `next dev` pod obciążeniem; zamówienia z E2E nie są realizowane, więc rezerwacje magazynu rosną.
- **Rozwiązanie:** restart serwera dev przed pełnym przebiegiem, ponowienie `--last-failed --workers=2`; doładowanie stanów magazynowych przez API admina (aktualizuj `stocked_quantity` i `raw_stocked_quantity`). Po kliknięciu "Dodaj do koszyka" czekaj na stan koszyka, nie na pierwszy toast. Kolejne uruchomienie po zmianie stanu może widzieć stary cache katalogu.

## Inny port niż domyślny
Słowa: `E2E_BASE_URL`, worktree, port, `SITE_URL`, CORS

- **Objaw:** testy SEO i zwrotów padają w worktree z innymi portami; ciasteczka sesji nie docierają.
- **Przyczyna:** adresy sklepu i panelu w `.env` wskazują domyślne porty.
- **Rozwiązanie:** ustaw `SITE_URL`, CORS i adres panelu na porty worktree; porównaj nazwy kluczy `.env` z głównym katalogiem (kopia bywa nieaktualna). Pojedyncze logowanie tego samego użytkownika w wielu równoległych testach nadpisuje sesje, więc sprzątanie rób kluczem integracyjnym.
