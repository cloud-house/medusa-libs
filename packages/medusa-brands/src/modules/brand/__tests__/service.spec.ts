import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { BRAND_MODULE } from '..'
import { Brand } from '../models/brand'
import type BrandModuleService from '../service'

jest.setTimeout(60 * 1000)

// Medusa passes `moduleOptions` the way it passes a plugin's `options` to the plugin's modules.
moduleIntegrationTestRunner<BrandModuleService>({
  moduleName: BRAND_MODULE,
  moduleModels: [Brand],
  resolve: './src/modules/brand',
  moduleOptions: { locale: 'en', storeRoute: false, messages: { saved: 'Done' } },
  testSuite: ({ service }) => {
    describe('BrandModuleService', () => {
      it('gets the module options, defaults filled in', () => {
        const options = service.getOptions()
        expect(options.locale).toBe('en')
        expect(options.storeRoute).toBe(false)
        expect(options.messages.saved).toBe('Done')
        expect(options.messages.edit).toBe('Edit')
      })

      it('keeps one brand per handle', async () => {
        await service.createBrands({ name: 'Aqua Marina', handle: 'aqua-marina' })
        await expect(
          service.createBrands({ name: 'Aqua Marina 2', handle: 'aqua-marina' }),
        ).rejects.toThrow()
      })

      it('lets a handle be reused after the brand is deleted', async () => {
        const [brand] = await service.createBrands([{ name: 'F2', handle: 'f2' }])
        await service.softDeleteBrands(brand.id)
        await expect(service.createBrands({ name: 'F2', handle: 'f2' })).resolves.toBeDefined()
      })
    })
  },
})

moduleIntegrationTestRunner<BrandModuleService>({
  moduleName: BRAND_MODULE,
  moduleModels: [Brand],
  resolve: './src/modules/brand',
  testSuite: ({ service }) => {
    describe('BrandModuleService without options', () => {
      it('falls back to Polish and the store route on', () => {
        const options = service.getOptions()
        expect(options.locale).toBe('pl')
        expect(options.storeRoute).toBe(true)
        expect(options.messages.saved).toBe('Zapisano markę')
      })
    })
  },
})
