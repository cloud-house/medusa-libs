import { z } from '@medusajs/framework/zod'

/** Shortest password the account routes accept. */
export const PASSWORD_MIN_LENGTH = 8

const email = z.string().trim().toLowerCase().max(254).email()
const password = z.string().min(PASSWORD_MIN_LENGTH).max(128)
const name = z.string().trim().min(1).max(100)

export const StoreAccountRegister = z
  .object({
    email,
    password,
    first_name: name,
    last_name: name,
    phone: z.string().trim().min(1).max(30),
  })
  .strict()
export type StoreAccountRegisterType = z.infer<typeof StoreAccountRegister>

export const StoreAccountConfirmEmail = z
  .object({ code: z.string().trim().min(1).max(200) })
  .strict()
export type StoreAccountConfirmEmailType = z.infer<typeof StoreAccountConfirmEmail>

export const StoreAccountEmpty = z.object({}).strict()

export const StoreAccountRegisterFromOrder = z
  .object({
    order_id: z.string().trim().min(1).max(100),
    cart_id: z.string().trim().min(1).max(100),
    password,
  })
  .strict()
export type StoreAccountRegisterFromOrderType = z.infer<typeof StoreAccountRegisterFromOrder>

export const StoreAccountPassword = z
  .object({ current_password: z.string().min(1).max(128), new_password: password })
  .strict()
export type StoreAccountPasswordType = z.infer<typeof StoreAccountPassword>

export const StoreAccountDelete = z.object({ password: z.string().min(1).max(128) }).strict()
export type StoreAccountDeleteType = z.infer<typeof StoreAccountDelete>

export const StoreAccountCart = z.object({ cart_id: z.string().trim().min(1).max(100) }).strict()
export type StoreAccountCartType = z.infer<typeof StoreAccountCart>

export const StoreAccountSetPassword = z
  .object({ code: z.string().trim().min(1).max(200), password })
  .strict()
export type StoreAccountSetPasswordType = z.infer<typeof StoreAccountSetPassword>
