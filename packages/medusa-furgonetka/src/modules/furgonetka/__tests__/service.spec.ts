import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { FURGONETKA_MODULE } from '..'
import { FurgonetkaConnection } from '../models/connection'
import { ParcelTemplate } from '../models/parcel-template'
import { Shipment } from '../models/shipment'
import type FurgonetkaModuleService from '../service'

jest.setTimeout(60 * 1000)

const receiver = {
  name: 'Jan Kowalski',
  company: null,
  phone: '+48600100200',
  email: 'jan@example.com',
  street: 'Długa 1',
  postal_code: '80-001',
  city: 'Gdańsk',
  point: null,
  point_label: null,
}

const parcel = {
  template_id: null,
  name: 'Karton deski',
  kind: 'box',
  length_cm: 95,
  width_cm: 45,
  height_cm: 30,
  weight_g: 15000,
}

const shipmentInput = (orderId: string, extra: Record<string, unknown> = {}) => ({
  order_id: orderId,
  carrier: 'dpd' as const,
  receiver,
  // `model.json()` is typed as a record, an array of parcels needs the cast.
  parcels: [parcel] as unknown as Record<string, unknown>,
  declared_value_cents: 129900,
  ...extra,
})

const template = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  kind: 'box' as const,
  length_cm: 40,
  width_cm: 30,
  height_cm: 20,
  weight_g: 3000,
  purpose: null,
  ...extra,
})

moduleIntegrationTestRunner<FurgonetkaModuleService>({
  moduleName: FURGONETKA_MODULE,
  moduleModels: [Shipment, ParcelTemplate, FurgonetkaConnection],
  resolve: './src/modules/furgonetka',
  moduleOptions: {
    resolveOrder: async () => null,
    parcelClasses: [{ key: 'board', label: 'Deska' }],
  },
  testSuite: ({ service }) => {
    describe('parcel class purposes (kit step 4c)', () => {
      it('stores the key of any parcel class as the purpose of a template', async () => {
        const saved = await service.saveTemplate({ ...template('Karton sofy'), purpose: 'sofa' })

        expect(saved.purpose).toBe('sofa')
      })

      it('moves a purpose to another template and keeps the unique index', async () => {
        const first = await service.saveTemplate({ ...template('A'), purpose: 'mattress' })
        const second = await service.saveTemplate({ ...template('B'), purpose: 'mattress' })

        expect(second.purpose).toBe('mattress')
        expect((await service.retrieveParcelTemplate(first.id)).purpose).toBeNull()
      })
    })

    describe('FurgonetkaModuleService shipments', () => {
      it('starts a shipment as a draft with no pickup ordered', async () => {
        const row = await service.createShipments(shipmentInput('order_1'))

        expect(row).toMatchObject({
          order_id: 'order_1',
          state: 'draft',
          pickup: 'courier',
          pickup_status: 'none',
          tracking: null,
          fulfillment_id: null,
        })
      })

      it('refuses a second active shipment for the same order (partial unique index)', async () => {
        await service.createShipments(shipmentInput('order_2'))

        await expect(service.createShipments(shipmentInput('order_2'))).rejects.toThrow()
        expect(await service.listShipments({ order_id: 'order_2' })).toHaveLength(1)
      })

      it('allows a new active shipment next to a canceled one', async () => {
        const first = await service.createShipments(shipmentInput('order_3'))
        await service.updateShipments({ id: first.id, state: 'canceled' })

        const second = await service.createShipments(shipmentInput('order_3'))

        expect(second.id).not.toBe(first.id)
        expect(await service.listShipments({ order_id: 'order_3' })).toHaveLength(2)
      })

      it('allows the same order twice once the first row is canceled, but not three active', async () => {
        const first = await service.createShipments(shipmentInput('order_4'))
        await service.updateShipments({ id: first.id, state: 'canceled' })
        await service.createShipments(shipmentInput('order_4'))

        await expect(service.createShipments(shipmentInput('order_4'))).rejects.toThrow()
      })

      it('finds the active shipment, the latest one and the one of a fulfillment', async () => {
        const first = await service.createShipments(shipmentInput('order_5'))
        await service.updateShipments({ id: first.id, state: 'canceled' })
        const second = await service.createShipments(
          shipmentInput('order_5', { fulfillment_id: 'ful_1' }),
        )

        expect((await service.activeShipment('order_5'))?.id).toBe(second.id)
        expect((await service.latestShipment('order_5'))?.id).toBe(second.id)
        expect((await service.shipmentByFulfillment('ful_1'))?.id).toBe(second.id)

        await service.updateShipments({ id: second.id, state: 'canceled' })
        expect(await service.activeShipment('order_5')).toBeNull()
        expect((await service.latestShipment('order_5'))?.id).toBe(second.id)
      })

      it('finds the newest row when a canceled one and its replacement share a fulfillment', async () => {
        const first = await service.createShipments(
          shipmentInput('order_6', { fulfillment_id: 'ful_shared' }),
        )
        await service.updateShipments({ id: first.id, state: 'canceled' })
        const second = await service.createShipments(
          shipmentInput('order_6', { fulfillment_id: 'ful_shared' }),
        )

        expect((await service.shipmentByFulfillment('ful_shared'))?.id).toBe(second.id)
      })

      it('returns null for an unknown order or fulfillment', async () => {
        expect(await service.activeShipment('order_unknown')).toBeNull()
        expect(await service.latestShipment('order_unknown')).toBeNull()
        expect(await service.shipmentByFulfillment('ful_unknown')).toBeNull()
      })
    })

    describe('FurgonetkaModuleService connection', () => {
      it('has no connection row until one is created, then returns the only one', async () => {
        expect(await service.connection()).toBeNull()

        const created = await service.createFurgonetkaConnections({})

        expect(created.state).toBe('disconnected')
        expect((await service.connection())?.id).toBe(created.id)
      })
    })

    describe('FurgonetkaModuleService parcel templates', () => {
      it('creates a template without a purpose', async () => {
        const row = await service.saveTemplate(template('Karton średni'))

        expect(row).toMatchObject({ name: 'Karton średni', kind: 'box', purpose: null })
        expect(row.id).toMatch(/^ptpl_/)
      })

      it('moves a purpose from its previous owner to the template that takes it', async () => {
        const board = await service.saveTemplate(template('Karton deski', { purpose: 'board' }))

        const other = await service.saveTemplate(template('Karton nowy', { purpose: 'board' }))

        expect(other.purpose).toBe('board')
        expect((await service.retrieveParcelTemplate(board.id)).purpose).toBeNull()
        expect(await service.listParcelTemplates({ purpose: 'board' })).toHaveLength(1)
      })

      it('moves a purpose onto an existing template', async () => {
        const board = await service.saveTemplate(template('Karton deski', { purpose: 'board' }))
        const plain = await service.saveTemplate(template('Karton zwykły'))

        await service.saveTemplate({ ...template('Karton zwykły'), id: plain.id, purpose: 'board' })

        expect((await service.retrieveParcelTemplate(plain.id)).purpose).toBe('board')
        expect((await service.retrieveParcelTemplate(board.id)).purpose).toBeNull()
      })

      it('updates the values of a template and keeps its purpose', async () => {
        const board = await service.saveTemplate(template('Karton deski', { purpose: 'board' }))

        const updated = await service.saveTemplate({
          ...template('Karton deski XL'),
          id: board.id,
          length_cm: 100,
          purpose: 'board',
        })

        expect(updated).toMatchObject({ id: board.id, name: 'Karton deski XL', length_cm: 100 })
        expect(updated.purpose).toBe('board')
      })

      it('refuses to take the purpose off the template that has it', async () => {
        const board = await service.saveTemplate(template('Karton deski', { purpose: 'board' }))

        await expect(
          service.saveTemplate({ ...template('Karton deski'), id: board.id, purpose: null }),
        ).rejects.toMatchObject({
          type: 'not_allowed',
          message:
            'Każde przeznaczenie musi mieć szablon – przypisz je najpierw innemu szablonowi.',
        })
        expect((await service.retrieveParcelTemplate(board.id)).purpose).toBe('board')
      })

      it('refuses to swap the purpose of a template for another one (the first would be left bare)', async () => {
        const board = await service.saveTemplate(template('Karton deski', { purpose: 'board' }))

        await expect(
          service.saveTemplate({
            ...template('Karton deski'),
            id: board.id,
            purpose: 'courier_only',
          }),
        ).rejects.toMatchObject({ type: 'not_allowed' })
        expect((await service.retrieveParcelTemplate(board.id)).purpose).toBe('board')
      })

      it('removes a template without a purpose', async () => {
        const plain = await service.saveTemplate(template('Karton średni'))

        await service.removeTemplate(plain.id)

        expect(await service.listParcelTemplates({ id: plain.id })).toHaveLength(0)
      })

      it('refuses to remove a template that has a purpose', async () => {
        const board = await service.saveTemplate(template('Karton deski', { purpose: 'board' }))

        await expect(service.removeTemplate(board.id)).rejects.toMatchObject({
          type: 'not_allowed',
          message:
            'Szablonu z przeznaczeniem nie można usunąć – przypisz przeznaczenie innemu szablonowi.',
        })
        expect(await service.listParcelTemplates({ id: board.id })).toHaveLength(1)
      })

      it('says not found for an unknown template', async () => {
        await expect(
          service.saveTemplate({ ...template('Duch'), id: 'ptpl_missing' }),
        ).rejects.toMatchObject({ type: 'not_found' })
        await expect(service.removeTemplate('ptpl_missing')).rejects.toMatchObject({
          type: 'not_found',
        })
      })
    })
  },
})
