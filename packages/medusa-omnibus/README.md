# @cloud-house/medusa-omnibus

Medusa 2 plugin: price history for the Omnibus directive (the lowest price in the 30 days before a
reduction). An hourly job stores the current price of every published variant in every region
whenever it changed; read the history with `@cloud-house/commerce-rules` (`lowestPriceBeforeDiscount`, `OMNIBUS_WINDOW_DAYS`).

```sh
pnpm add --save-exact @cloud-house/medusa-omnibus@0.1.1
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README).

## Setup

```ts
// medusa-config.ts
plugins: [
  {
    resolve: '@cloud-house/medusa-omnibus',
    options: {
      locale: 'pl', // 'pl' | 'en', default 'pl'
      messages: { recorded: (count) => `…` }, // single texts over the dictionary
      logPrefix: 'Shop', // job log line becomes "Shop: <text>"; default none
    },
  },
],
```

Then `medusa db:migrate` (module `priceHistory`, table `price_snapshot`). Do not also list the module
under `modules`: an entry there replaces the plugin's module and its options.

## What it adds

- Module `priceHistory` (`PRICE_HISTORY_MODULE`) with `listHistoryByVariant(variantIds, regionId)`
  and `listLatestByVariant(variantIds, regionId)`.
- Workflow `recordPriceSnapshotsWorkflow` and the event `price-history.recorded`
  (`PRICE_HISTORY_RECORDED`, data `{ variant_ids }`).
- Job `record-price-snapshots`, schedule `0 * * * *` (fixed: Medusa reads a job's schedule
  statically, so it is not an option).
