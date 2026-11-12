---
'@cloud-house/medusa-brands': patch
---

Remove the plugin's `/brands/:id` admin page (a shop's own page at that path collided with it); the list shows a "details" button only with the new option `adminDetailLinks`, which `GET /admin/brands/messages` reports as `settings.detailLinks`. Neutral default texts (`adminDescription`, `handleHint` no longer name a storefront path). Fix option and event comments, `types` condition on the `./workflows` export.
