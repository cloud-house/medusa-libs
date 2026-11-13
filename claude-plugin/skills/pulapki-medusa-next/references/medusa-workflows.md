# Medusa: workflows, zdarzenia, kwoty

## Workflow ignoruje albo psuje `input`
Słowa: `createWorkflow`, `transform`, `input`, composition, template string

- **Objaw:** w `createWorkflow` odwołanie do `input.pole`, interpolacja w stringu, `input.items[0]` albo `if` daje `undefined`, błąd kompilacji lub wartość z momentu składania workflow.
- **Przyczyna:** ciało workflow to kompozycja, nie zwykły kod: jest wykonywana raz przy rejestracji, a `input` i wyniki kroków to uchwyty (proxy), nie wartości.
- **Rozwiązanie:** każdą operację na wartościach (indeks, sklejanie tekstu, warunek, mapowanie) zrób w `transform(...)`, a rozgałęzienia w `when(...)`. Do kroków przekazuj całe obiekty.

## `completeCartWorkflow` ma tylko hook `validate`
Słowa: `completeCartWorkflow`, hook, `order.placed`, zamówienie

- **Objaw:** chcesz zareagować po utworzeniu zamówienia, ale hooków po stronie "po" nie ma.
- **Przyczyna:** workflow wystawia wyłącznie hook `validate` (przed utworzeniem).
- **Rozwiązanie:** reguły blokujące (np. zakaz przedsprzedaży) w `validate`; reakcje po fakcie w subskrybencie `order.placed`. `complete` jest idempotentne przez `order_cart`, więc ponowne wywołanie zwraca to samo zamówienie.

## Nazwy zdarzeń modułów i workflow bez zdarzeń
Słowa: event, subscriber, `batchLinkProductsToCategoryWorkflow`, `receiveAndCompleteReturnOrderWorkflow`

- **Objaw:** subskrybent nie dostaje zdarzenia po operacji.
- **Przyczyna:** zdarzenia serwisów modułów nazywają się `{moduł}.{model}.{akcja}`, a niektóre workflow nie emitują nic (`batchLinkProductsToCategoryWorkflow`, `receiveAndCompleteReturnOrderWorkflow`). Częściowe przyjęcie zwrotu (`partially_received`) emituje `order.return_received`, a zwroty z claim/exchange też.
- **Rozwiązanie:** sprawdź w kodzie Medusy, czy zdarzenie istnieje, zanim zbudujesz na nim logikę. Dla workflow bez zdarzeń dodaj job zamiatający jako siatkę bezpieczeństwa; zdarzenia claim/exchange odfiltruj po `claim_id` / `exchange_id`.

## Kwoty zamówienia nie uwzględniają zwrotów ani credit lines
Słowa: `total`, `item_total`, `original_total`, `return_received_total`, `credit_line_total`, faktura korygująca

- **Objaw:** po przyjęciu zwrotu `order.total` i sumy pozycji są niższe/inne, niż klient zapłacił; faktura lub widok klienta pokazuje złą kwotę.
- **Przyczyna:** Medusa 2.21 liczy `total`, `item_total`, `tax_total` i `original_total` BEZ sztuk przyjętych z powrotem (`return_received_total`, `return_dismissed_total`), a `order.total` obniża o credit lines z refundów (`credit_line_total`).
- **Rozwiązanie:** do kwot sprzedaży doliczaj te wartości z powrotem w jednym helperze (np. `saleTotal`), a VAT zwróconej części i cenę katalogową wyprowadzaj z niego.

## Promocje: kwota netto i brak odświeżenia dostawy
Słowa: promotion, `buy-get`, adjustment, `is_tax_inclusive`, shipping method

- **Objaw:** rabat z promocji "kup X, dostań Y" jest o VAT mniejszy niż w koszyku; po zmianie kodu rabatowego koszt dostawy zostaje stary.
- **Przyczyna:** Medusa zapisuje `amount` korekty promocji netto (`is_tax_inclusive: false`) nawet przy cenach brutto; buy-get liczy się od netto `subtotal` i powtarza do `max_quantity`. Aktualizacja promocji nie odświeża metod dostawy w koszyku.
- **Rozwiązanie:** brutto rabatu = `amount * original_total / subtotal`. Wybraną dostawę zapisuj ponownie przy każdym zatwierdzeniu koszyka, nie tylko gdy widać promocję (po usunięciu kodu nie ma już czego wykryć).

## Koszyk Store API: brak opcji wariantów, znikające sumy
Słowa: `fields`, `+`, cart, totals, variant options, metadata

- **Objaw:** `GET /store/carts/:id` nie zwraca opcji wariantu (rozmiar, kolor); po własnym `fields` znikają sumy.
- **Przyczyna:** store cart nie zwraca opcji wariantów; `fields` bez prefiksu `+` zastępuje domyślny zestaw zamiast go rozszerzać. Metadata koszyka jest scalana (pusty string `''` usuwa klucz), ale adresy są zastępowane w całości.
- **Rozwiązanie:** `fields=+items.xxx,...` zawsze z plusem; rozmiar i kolor bierz z własnego katalogu; adres wysyłaj zawsze kompletny.

## Migracje, skrypty jednorazowe i transakcje
Słowa: migration, `db:migrate`, script, flush, unique, `model.json`

- **Objaw:** skrypt migracyjny nie uruchamia się drugi raz; zapis "usuń i wstaw tę samą unikalną wartość" w jednej transakcji kończy się naruszeniem unikalności; `model.json()` nie typuje się.
- **Przyczyna:** skrypty migracyjne (`src/migration-scripts`) wykonują się raz na bazę. W transakcji MikroORM wykonuje najpierw wstawienia, potem aktualizacje. `model.json()` jest `Record<string, unknown>`.
- **Rozwiązanie:** skrypt pisz jako idempotentny i nie licz na powtórkę; przed wstawieniem tej samej unikalnej wartości zrób jawny `flush` po usunięciu; zawartość `json` czytaj przez typowane akcesory. `medusa db:migrate` odpala też własne oczekujące migracje Medusy (np. tworzenie roli super-admina) - to normalne.

## Wysyłka: `createOrderShipmentWorkflow` nadpisuje etykiety
Słowa: fulfillment, labels, `tracking_url`, shipment, manual provider

- **Objaw:** po oznaczeniu paczki jako wysłanej znikają wcześniejsze etykiety; link śledzenia to `#`.
- **Przyczyna:** `createOrderShipmentWorkflow` ZASTĘPUJE etykiety przekazanymi; dashboard Medusy przy ręcznej wysyłce wysyła `tracking_url: '#'`. Dostawca `manual` etykiety zachowuje.
- **Rozwiązanie:** przy tworzeniu przesyłki podaj wszystkie etykiety jeszcze raz; adres śledzenia waliduj jako http(s) i wyświetlaj tylko prawdziwy. Zrealizowane zamówienia w Medusie zostają `pending` na zawsze, więc nie opieraj na statusie listy "do wysyłki".

## Błąd z kroku workflow dociera do trasy jako zwykły obiekt
Słowa: `instanceof MedusaError`, `__isMedusaError`, `type`, `code`, `StepResponse`, `invalid_request_error`

- **Objaw:** trasa łapie błąd rzucony w kroku workflow i sprawdza `err instanceof MedusaError`; sprawdzenie jest fałszywe, odpowiedź HTTP ma `code: 'invalid_request_error'` zamiast własnego kodu (test HTTP pokazał to przy duplikacie handle marki).
- **Przyczyna:** błąd przechodzi przez serializację silnika workflow i wraca jako zwykły `Error` z polami `__isMedusaError`, `type`, `code`, `message`, nie jako instancja klasy (źródło: obserwacja w `medusa-brands`, Task 5 kroku 2; mechanizm w silniku nie badany).
- **Rozwiązanie:** rozpoznawaj błąd po `type` i `code` (np. `err.type === 'duplicate_error' && err.code === BRAND_ERROR_CODES.handleTaken`), a nie po `instanceof`; test HTTP na kod w odpowiedzi.

## Zdarzenia pluginu a zdarzenia modułów Medusy: nazwa `brand.*` nie koliduje
Słowa: `brand.created`, `product-brand.updated`, `{moduł}.{model}.{akcja}`, `eventBusModuleService`

- **Objaw:** obawa, że neutralna nazwa zdarzenia pluginu (`brand.updated`) zderzy się ze zdarzeniami generowanymi przez Medusę dla modułu `brand`.
- **Przyczyna:** zdarzenia generowane przez serwis modułu mają nazwę `<serwis>.<model>.<akcja>` (dla modułu `brand` i modelu `brand`: `brand.brand.created`), więc dwuczłonowa nazwa `brand.created` jest wolna (źródło: konwencja `MedusaService` w 2.21, sprawdzona przy `medusa-brands`).
- **Rozwiązanie:** zdarzenia pluginu emituj w workflow (`emitEventStep`) pod nazwami bez prefiksu sklepu (`brand.created|updated|deleted`, `product-brand.updated`), eksportuj je jako stałe (`BRAND_EVENTS`); sklep przy przejściu na plugin zmienia nazwy w subskrybentach (stare nazwy z prefiksem sklepu → `brand.*`). Same nazwy generowane przez Medusę ignoruj.
