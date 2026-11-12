---
name: pulapki-medusa-next
description: Use when working on a Medusa 2 + Next.js shop or on a Medusa plugin and something behaves strangely - failing or flaky tests (jest, vitest, Playwright), a workflow that ignores its input, HTTP error codes that differ from MedusaError, stale Next cache or metadata, Stripe.js side effects, Lexical editor quirks, pnpm 11 monorepo, registry auth or CI problems. Collected pitfalls with symptom, cause and fix.
---

# Pułapki Medusa 2 + Next.js

Pułapki zebrane przy budowie pierwszego sklepu na Medusie 2.21 i Next.js 16. Każda ma trzy części: **Objaw** (co widać), **Przyczyna**, **Rozwiązanie**. Zanim zaczniesz debugować dziwne zachowanie, znajdź w indeksie plik o właściwym obszarze i przeszukaj go po słowach z nagłówka pułapki.

Wersje: Medusa 2.21.x, Next 16.x, pnpm 11, Node 24. Przy innych wersjach sprawdź, czy pułapka nadal występuje.

## Indeks

- `references/medusa-testy.md` - jest i `moduleIntegrationTestRunner` / `medusaIntegrationTestRunner`: izolacja od bazy deweloperskiej, pamięć, limity połączeń, szpiegowanie serwisów, joby w testach, flaky seed.
- `references/medusa-workflows.md` - workflows i zdarzenia: `transform` zamiast dotykania `input`, hooki, nazwy zdarzeń, kwoty zamówień i promocji, migracje i transakcje.
- `references/medusa-bledy-http.md` - mapowanie `MedusaError` na statusy HTTP, middleware, zamknięte trasy, konta i sesje klientów, kształt odpowiedzi SDK.
- `references/medusa-plugin.md` - budowa pluginu Medusy: migracje i wydzielanie modułów ze sklepu, panel admina, `plugin:build` bez `src/admin`, `exports`, opcje pluginu, kody błędów, nadpisania tekstów, typy, zależności, moduł Notification.
- `references/next-cache-metadane.md` - Next 16: cache danych, wersja kształtu w kluczu, metadane, `ImageResponse`, historia przeglądarki, `redirect()`, nagłówki proxy.
- `references/stripe.md` - Stripe.js: skutki uboczne importu, ciasteczka trzecich stron, opcje Elements.
- `references/lexical.md` - edytor Lexical w panelu: węzły dekoratorów, scalanie tekstu.
- `references/playwright.md` - Playwright i testy E2E: `exact: true`, `aria-disabled`, kolejność uruchamiania, stan współdzielony, dev server.
- `references/vitest.md` - Vitest (tryb browser): `optimizeDeps`, mocki, timery, `beforeEach`.
- `references/pnpm-monorepo.md` - pnpm 11, hoisting Medusy, Node, przebudowa pakietów po pullu, rejestr GitHub Packages (token, widoczność, uprawnienia `gh`), release z changesetami, CI.
- `references/shell.md` - powłoka: `set -o pipefail`, heredoc z backtickami, zsh.
