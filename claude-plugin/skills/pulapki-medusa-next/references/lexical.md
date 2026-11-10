# Lexical (edytor treści w panelu)

## Bloki zamieniają się w akapity
Słowa: `DecoratorNode`, `isInline`, Lexical, blok, akapit

- **Objaw:** wstawiony własny blok (galeria, produkt) po zapisie i odczycie staje się zwykłym akapitem albo znika.
- **Przyczyna:** węzły dekoratorów w Lexical są domyślnie inline.
- **Rozwiązanie:** w klasie węzła `isInline(): boolean { return false }`.

## Test round-trip psuje się na formatowaniu
Słowa: `TextNode`, scalanie, format, normalizacja

- **Objaw:** serializacja po odczycie różni się od wejściowej (dwa sąsiednie teksty stały się jednym).
- **Przyczyna:** Lexical scala sąsiednie węzły tekstowe o tym samym formacie.
- **Rozwiązanie:** test round-trip normalizuje oba drzewa przed porównaniem. Przypnij jedną wersję `lexical` w całym repo (ta sama, której używa edytor hosta), bo różne wersje serializują różnie.

## Bezpieczne linki w treści
Słowa: `javascript:`, link, renderer, `isSafeLinkUrl`

- **Objaw:** link z treści edytora może mieć adres `javascript:`.
- **Przyczyna:** renderer i schemat zapisu przyjmują dowolny adres.
- **Rozwiązanie:** jedna funkcja `isSafeLinkUrl` użyta w schemacie zapisu i w rendererze.
