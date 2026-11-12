# @cloud-house/commerce-rules

## 0.2.0

### Minor Changes

- Customer-facing output is no longer hard-coded Polish: `lineDiscountLabel(parts, { locale, messages })` (pl/en dictionaries, `DISCOUNT_LABEL_MESSAGES`), `sellerLine(seller, { locale, taxIdLabel })`, `isValidPostalCode(value, country = 'PL')` (other countries throw), `formatPrice` treats `pl-PL` like `pl`. Breaking: `pluralize(count, forms, { locale })` replaces the positional locale argument. Polish defaults are unchanged.

## 0.1.0

### Minor Changes

- First release: price formatting (PLN/pl hand path, other currencies and locales via Intl), pluralization (`pluralizePl`, `pluralize`), NIP, seller helpers, Omnibus lowest price, line discounts and stock status.
