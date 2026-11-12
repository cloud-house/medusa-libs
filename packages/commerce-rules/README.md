# @cloud-house/commerce-rules

Pure, dependency-free commerce rules for online shops. ESM + CJS, with types.

```sh
pnpm add @cloud-house/commerce-rules
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`.

## Exports

Everything customer-facing is Polish by default and takes an options object as the last argument.

- `formatPrice(amount, { currency = 'PLN', locale = 'pl' })` – `1 899 zł` for PLN with `pl` / `pl-PL` / any `pl-*`, `Intl.NumberFormat` for the rest (an invalid currency code throws `RangeError`)
- `pluralize(count, forms, { locale = 'pl' })` – via `Intl.PluralRules`; `pluralizePl(count, [one, few, many])`
- `lineDiscountLabel(parts, { locale = 'pl', messages })` – "Rabat zestawowy" / "Kod X" / "Rabat zestawowy + kod X"; `en` gives "Bundle discount" / "Code X"; `messages` overrides single keys (`bundle`, `code`, `bundleAndCode`, `{codes}` placeholder); dictionaries in `DISCOUNT_LABEL_MESSAGES`
- `sellerLine(seller, { locale = 'pl', taxIdLabel })` – "…, NIP 5260250274"; `en` gives "VAT ID", `taxIdLabel` overrides the label
- `isValidPostalCode(value, country = 'PL')` – only `PL` (00-000) is supported yet; other countries throw an `Error`
- `slugify`, `isValidNip`, `normalizeNip`
- other seller helpers (`seller.ts`): `toSellerInfo`, `isSellerComplete`, `sellerAddress`, `returnAddressText`, `returnAddressLines`
- `lowestPriceBeforeDiscount`, `OMNIBUS_WINDOW_DAYS` – Omnibus lowest price in the last 30 days
- `splitLineDiscount` – cart line discounts split into bundle and typed codes
- `stockStatus`, `isAvailableNow`, `STOCK_RANK`, `STOCK_STATUSES`, `LOW_STOCK_THRESHOLD`

## Options

| Function | Option | Default | Meaning |
| --- | --- | --- | --- |
| `formatPrice` | `currency` | `PLN` | ISO 4217 code |
| `formatPrice` | `locale` | `pl` | BCP 47; `pl*` + PLN uses the hand-written path |
| `pluralize` | `locale` | `pl` | BCP 47 for `Intl.PluralRules` |
| `lineDiscountLabel` | `locale` | `pl` | `pl` or `en` dictionary |
| `lineDiscountLabel` | `messages` | – | partial override; `undefined` values are ignored |
| `sellerLine` | `locale` | `pl` | `pl` ("NIP") or `en` ("VAT ID") |
| `sellerLine` | `taxIdLabel` | – | overrides the label |

```ts
pluralize(3, { one: 'item', other: 'items' }, { locale: 'en' }) // 'items'
lineDiscountLabel(parts, { locale: 'en' }) // 'Bundle discount + code SPRING10'
sellerLine(seller, { taxIdLabel: 'USt-IdNr.' })
isValidPostalCode('80-001') // true; isValidPostalCode('10115', 'DE') throws
```

## Upgrading from 0.1

`pluralize(count, forms, 'en')` became `pluralize(count, forms, { locale: 'en' })`. The rest is
backwards compatible; defaults produce the same Polish output.

## License

MIT
