import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, generateJwtToken, Modules } from '@medusajs/framework/utils'
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  updateStoresWorkflow,
} from '@medusajs/medusa/core-flows'

/** Bearer headers of a freshly created admin user. */
export async function createAdminHeaders(
  container: MedusaContainer,
): Promise<Record<string, string>> {
  const email = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  const user = await container.resolve(Modules.USER).createUsers({ email })
  const authIdentity = await container.resolve(Modules.AUTH).createAuthIdentities({
    provider_identities: [{ provider: 'emailpass', entity_id: email }],
    app_metadata: { user_id: user.id },
  })
  const token = generateJwtToken(
    {
      actor_id: user.id,
      actor_type: 'user',
      auth_identity_id: authIdentity.id,
      app_metadata: { user_id: user.id },
    },
    { secret: process.env.JWT_SECRET, expiresIn: '1d' },
  )
  return { authorization: `Bearer ${token}` }
}

export interface TestStore {
  publishableKey: string
  salesChannelId: string
  regionId: string
}

/** The minimum a store API call needs: sales channel, publishable key and a PL/pln region. */
export async function createStore(container: MedusaContainer): Promise<TestStore> {
  const {
    result: [channel],
  } = await createSalesChannelsWorkflow(container).run({
    input: { salesChannelsData: [{ name: 'Test channel' }] },
  })

  const {
    result: [key],
  } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: 'Test key', type: 'publishable', created_by: '' }] },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: key.id, add: [channel.id] },
  })

  // A region can only use currencies the store supports.
  const [store] = await container.resolve(Modules.STORE).listStores()
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [{ currency_code: 'pln', is_default: true }],
        default_sales_channel_id: channel.id,
      },
    },
  })

  const {
    result: [region],
  } = await createRegionsWorkflow(container).run({
    input: { regions: [{ name: 'Poland', currency_code: 'pln', countries: ['pl'] }] },
  })

  return { publishableKey: key.token, salesChannelId: channel.id, regionId: region.id }
}

export { ContainerRegistrationKeys }
