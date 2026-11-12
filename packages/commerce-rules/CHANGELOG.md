# @cloud-house/commerce-rules

## 0.4.0

### Minor Changes

- ad45e92: Add `HANDLE_PATTERN`, the pattern of a valid handle (the form `slugify` produces).

## 0.3.0

### Minor Changes

- f0121b3: Add generic cache-tag rules: `tagFor`, `productTag`, `categoryTag`, `brandTag`, `KIT_TAGS`, `KIT_TAG_KINDS`, `MAX_TAG_LENGTH`, `createTagRules` and `isKitTagAllowed`.

## 0.2.0

### Minor Changes

- Customer-facing output is no longer hard-coded Polish: `lineDiscountLabel(parts, { locale, messages })` (pl/en dictionaries, `DISCOUNT_LABEL_MESSAGES`), `sellerLine(seller, { locale, taxIdLabel })`, `isValidPostalCode(value, country = 'PL')` (other countries throw), `formatPrice` treats `pl-PL` like `pl`. Breaking: `pluralize(count, forms, { locale })` replaces the positional locale argument. Polish defaults are unchanged.

## 0.1.0

### Minor Changes

- First release: price formatting (PLN/pl hand path, other currencies and locales via Intl), pluralization (`pluralizePl`, `pluralize`), NIP, seller helpers, Omnibus lowest price, line discounts and stock status.
