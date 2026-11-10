# @cloud-house/commerce-rules

Pure, dependency-free commerce rules for online shops. ESM + CJS, with types.

```sh
pnpm add @cloud-house/commerce-rules
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`.

## Exports

- `formatPrice(amount, { currency = 'PLN', locale = 'pl' })` – `1 899 zł` for PLN/pl, `Intl.NumberFormat` for the rest
- `pluralize(count, forms, locale = 'pl')` – via `Intl.PluralRules`; `pluralizePl(count, [one, few, many])`
- `slugify`, `isValidNip`, `normalizeNip`
- seller helpers (`seller.ts`): seller line, return address text and lines
- `lowestPriceBeforeDiscount`, `OMNIBUS_WINDOW_DAYS` – Omnibus lowest price in the last 30 days
- `splitLineDiscount`, `lineDiscountLabel` – cart line discounts
- `stockStatus`, `isAvailableNow`, `STOCK_RANK`, `STOCK_STATUSES`, `LOW_STOCK_THRESHOLD`

## License

MIT
