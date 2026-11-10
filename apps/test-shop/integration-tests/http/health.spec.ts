import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createAdminHeaders, createStore } from '../helpers/admin'

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe('test-shop', () => {
      it('answers GET /health', async () => {
        const response = await api.get('/health')
        expect(response.status).toEqual(200)
      })

      it('createStore returns a usable store', async () => {
        const store = await createStore(getContainer())
        expect(store.publishableKey).toBeTruthy()
        expect(store.salesChannelId).toBeTruthy()
        expect(store.regionId).toBeTruthy()

        const response = await api.get('/store/regions', {
          headers: { 'x-publishable-api-key': store.publishableKey },
        })
        expect(response.status).toEqual(200)
        expect(response.data.regions.map((r: { id: string }) => r.id)).toContain(store.regionId)
      })

      it('createAdminHeaders authenticates against the admin API', async () => {
        const headers = await createAdminHeaders(getContainer())
        const response = await api.get('/admin/users/me', { headers })
        expect(response.status).toEqual(200)
      })
    })
  },
})
