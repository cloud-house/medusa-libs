---
name: nowy-sklep
description: Use when starting a new online shop for a client on the cloud-house kit (Medusa 2 + Next.js) - questions to ask the client (payments, couriers, invoices, KSeF, markets and currencies) and the steps up to the first order. DRAFT - the starter that makes the steps executable arrives in step 7 of the kit plan.
---

# Nowy sklep (SZKIC)

Szkic. Starter (szablon sklepu) powstaje w kroku 7 planu kitu; do tego czasu kroki 5-8 opisują stan docelowy, nie coś, co da się wykonać jednym poleceniem.

## Pytania do klienta

- **Płatności:** jakie metody (karta, BLIK, przelewy online, płatność przy odbiorze)? Dostawca (Stripe lub inny)? Czy klient ma już konto i klucze testowe?
- **Dostawa:** którzy kurierzy i paczkomaty? Czy klient ma własne umowy? Gabaryty i wagi produktów (czy są towary, które jadą tylko jednym kurierem)? Adres magazynu i godziny odbioru.
- **Faktury:** do każdego zamówienia czy na żądanie? System księgowy? Dane sprzedawcy i numeracja.
- **KSeF:** czy sprzedaż obejmuje firmy, osoby prywatne, oba? Co mówi księgowy o terminach i trybie? (Odpowiedź decyduje o ustawieniach wystawiania faktur; bez niej zostaw wyłączone.)
- **Rynki i waluty:** kraje sprzedaży, waluty, języki sklepu, stawki VAT, obowiązki informacyjne (cena sprzed obniżki).
- **Prawo:** regulamin, polityka prywatności, zwroty (okno, adres, koszt), reklamacje. Teksty zawsze do weryfikacji prawnika.
- **Treści i marka:** logo, kolory, zdjęcia, kategorie, kto prowadzi panel.
- **Analityka i zgody:** narzędzia, banner zgód.

## Kroki do pierwszego zamówienia

1. Repozytorium sklepu ze startera *(starter w kroku 7; dotąd ręcznie według README kitu)*.
2. `.npmrc` z rejestrem `@cloud-house` i token czytania pakietów w środowisku (zob. skill `pulapki-medusa-next`, `pnpm-monorepo.md`).
3. Baza i Redis lokalnie, `.env` z sekretami (nigdy w repo).
4. Pluginy kitu w `medusa-config.ts`, `medusa db:migrate`.
5. Regiony, waluty, magazyn, metody dostawy, sekcje podatkowe.
6. Dane demonstracyjne: kilka produktów, zdjęcia, stany magazynowe.
7. Storefront: zmienne środowiskowe, adres backendu, klucz publiczny.
8. Płatność testowa, zamówienie testowe, faktura i mail potwierdzający.
9. Testy E2E i kontrola dostępności przed pokazaniem klientowi.

Przy kłopotach z testami i środowiskiem zajrzyj do skilla `pulapki-medusa-next`.
