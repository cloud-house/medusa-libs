# Stripe

## Stripe.js ładuje się samym importem
Słowa: `@stripe/stripe-js`, `loadStripe`, `/pure`, ciasteczko, Lighthouse best-practices, `m.stripe.com`

- **Objaw:** Lighthouse daje kasie ocenę best-practices ok. 77 (ciasteczko trzeciej strony `m.stripe.com`), a Stripe.js ładuje się nawet bez kluczy.
- **Przyczyna:** główne wejście `@stripe/stripe-js` wstrzykuje `js.stripe.com` już przy imporcie (efekt uboczny).
- **Rozwiązanie:** `import { loadStripe } from '@stripe/stripe-js/pure'`, test który czerwienieje po cofnięciu zmiany. Z prawdziwymi kluczami Stripe.js i tak się wczyta (ciasteczko wraca); wtedy do wyboru: `loadStripe.setLoadParameters({ advancedFraudSignals: false })` (słabsze Radar) albo ładowanie Stripe.js dopiero po wyborze metody płatności.

## Opcje Elements i wielu dostawców
Słowa: `allowedPaymentMethodTypes`, `paymentMethodTypes`, Elements, BLIK, P24

- **Objaw:** opcja ograniczająca metody płatności w Elements jest ignorowana.
- **Przyczyna:** w stripe-js 10 opcja nazywa się `allowedPaymentMethodTypes` (nie `paymentMethodTypes`).
- **Rozwiązanie:** użyj właściwej nazwy. Zamówienia BLIK/P24 powstają przed rozliczeniem płatności (webhook później): faktury i wysyłka muszą na to poczekać.

## Testy bez kluczy
Słowa: test mode, klucze, `sk_test`, E2E karta

- **Objaw:** testy płatności kartą nie mają jak przejść w CI ani lokalnie.
- **Przyczyna:** brak kluczy testowych.
- **Rozwiązanie:** oznacz je jako pomijane bez kluczy i miej osobną konfigurację z kluczami (klucze wprowadza właściciel w `.env`; nigdy w repo ani w rozmowie). Wyniki Lighthouse kasy zmierz także z kluczami.
