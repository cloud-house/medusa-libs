---
name: plugin-kitu
description: Use when adding a new package or Medusa plugin to the medusa-libs kit repo (structure, options, PL and EN dictionaries, tests, changeset, publishing, wiring into a shop). DRAFT - the final content is written at the end of step 1 of the kit plan, after newsletter and omnibus.
---

# Plugin kitu (SZKIC)

Szkic. Pełna treść powstanie po tym, jak newsletter i omnibus przejdą cały proces, żeby skill opisywał to, co faktycznie zrobiono.

## Plan treści

1. **Czy to powinien być pakiet?** Czysta logika bez tekstów dla klienta idzie do `packages/commerce-rules`; moduł, trasy i panel admina do osobnego pluginu Medusy.
2. **Struktura:** `packages/<nazwa>` ze `src`, testami, `package.json` (`license`, `repository.directory`, `publishConfig`, `files` tylko z buildem, peery z catalogu `medusa-peer`).
3. **Opcje pluginu:** sensowne domyślne (`locale: 'pl'`), sekret storefrontu z nazwą nagłówka i env, brak sekretu = każde żądanie odrzucone kodem 401.
4. **Teksty:** słowniki `pl` i `en`, opcja `locale`, opcja `messages` z częściowym nadpisaniem; API zwraca też stały `code` błędu.
5. **Testy:** unit (jest `TEST_TYPE=unit` albo vitest), moduł (`moduleIntegrationTestRunner`), HTTP w `apps/test-shop`.
6. **Changeset i publikacja:** `pnpm changeset`, PR "Version packages", publikacja do GitHub Packages.
7. **Podpięcie w sklepie:** `.npmrc`, `plugins` w `medusa-config.ts`, `db:migrate`; przy przenoszeniu istniejącego modułu zachowaj nazwy klas migracji, tabel i klucz modułu.

Zanim zaczniesz, przejrzyj skill `pulapki-medusa-next` (testy, migracje, panel pluginu, rejestr).
