# Powłoka

## Błąd w potoku jest ukryty
Słowa: `set -o pipefail`, `| tail`, `| head`, exit code, typecheck

- **Objaw:** `pnpm typecheck | tail` kończy się kodem 0 mimo błędów; skrypt CI "przechodzi" na zepsutym buildzie.
- **Przyczyna:** kod wyjścia potoku to kod ostatniego polecenia.
- **Rozwiązanie:** `set -o pipefail` (w skryptach `set -euo pipefail`); przy jednorazowym poleceniu sprawdź `${pipestatus[@]}` (zsh) / `${PIPESTATUS[@]}` (bash) albo zapisz wynik do pliku.

## Heredoc bez cudzysłowu wykonuje backticki
Słowa: heredoc, backtick, `<<'EOF'`, markdown

- **Objaw:** w pliku Markdown zapisanym z poziomu powłoki znikają fragmenty w backtickach albo pojawiają się wyniki poleceń.
- **Przyczyna:** `<<EOF` bez cudzysłowu rozwija `` `cmd` `` i `$zmienne`.
- **Rozwiązanie:** zawsze `<<'EOF'`.

## zsh: zmienna `path` psuje `PATH`
Słowa: zsh, `path`, pętla `for`, command not found

- **Objaw:** po pętli `for path in ...` polecenia przestają się znajdować.
- **Przyczyna:** w zsh `path` jest tablicą powiązaną z `PATH`.
- **Rozwiązanie:** nie nazywaj zmiennych `path` (ani `status`, `pipestatus`); użyj `p` lub `file`.

## Zmienne środowiskowe w nieinteraktywnych powłokach
Słowa: nvm, PATH, non-interactive, `export`

- **Objaw:** narzędzie uruchamiane z agenta lub CI używa innej wersji Node niż w terminalu.
- **Przyczyna:** `nvm` ładuje się z profilu interaktywnego.
- **Rozwiązanie:** ustaw `PATH` wprost na katalog właściwego Node na początku polecenia.
