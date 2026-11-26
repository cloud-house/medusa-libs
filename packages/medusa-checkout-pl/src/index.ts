export { orderPlacedData } from './emails/demo-order'
export { checkoutEmailTemplates } from './emails/templates'
export type {
  EmailContact,
  EmailLine,
  EmailLineGroup,
  OrderPlacedEmailData,
} from './emails/types'
export { CHECKOUT_PL_ERROR_CODES, type CheckoutPlErrorCode } from './errors'
export { guestOrderGuard } from './lib/guard'
export { loadOrderPlacedEmail, replyToFor } from './lib/order-email'
export { type OrderPlacedExtras, toOrderPlacedEmailData } from './lib/order-email-data'
export {
  loadOrderSummary,
  readOrderDetail,
  toOrderSummary,
  withoutReturnMethods,
} from './lib/order-summary'
export { PAID_STATUSES } from './lib/payment-status'
export { checkoutPlOptions } from './lib/plugin-options'
export { adjustmentCodes, typedPromotionCodes } from './lib/promotion-codes'
export {
  creditedShare,
  paidTotal,
  returnedShare,
  type SaleRow,
  type SaleShare,
  saleAmounts,
  saleTotal,
} from './lib/sale-amounts'
export { listShippingRates, type ShippingOptionRow, toShippingRate } from './lib/shipping-rates'
export { CHECKOUT_PL_MODULE } from './modules/checkout-pl'
export type { default as CheckoutPlModuleService } from './modules/checkout-pl/service'
export type {
  CheckoutPlOptions,
  CheckoutTexts,
  DeliveryCodes,
  LineGroup,
  ResolvedCheckoutPlOptions,
} from './options'
export {
  type PaymentModulesOptions,
  paymentModules,
  regionPaymentProviders,
  SYSTEM_PROVIDER,
} from './payments'
export type { BlockReason, CheckoutContact, ParcelBlocker } from './types'
