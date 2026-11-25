import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import type { Sender } from './client'
import { normalizePhone } from './plan'
import { furgonetkaOptions } from './plugin-options'

/** The shop's contact; a resolver that fails counts as no contact. */
async function contactOf(container: MedusaContainer) {
  try {
    return (await furgonetkaOptions(container).resolveContact?.(container)) ?? null
  } catch {
    return null
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/**
 * The warehouse the parcels leave from (spec 6d §5.1): the address and phone of the stock location
 * named by `stockLocationName` (else the first one with an address; Settings → Locations) and the
 * contact e-mail of the shop. `null` while the
 * street, postal code, city or phone is empty – the list and the card then refuse to create
 * shipments. The name is the company of the address, else the name of the shop.
 */
export async function loadSender(container: MedusaContainer): Promise<Sender | null> {
  const options = furgonetkaOptions(container)
  const locations = await container
    .resolve(Modules.STOCK_LOCATION)
    .listStockLocations(options.stockLocationName ? { name: options.stockLocationName } : {}, {
      relations: ['address'],
      take: options.stockLocationName ? 1 : 50,
    })
  const location = options.stockLocationName
    ? locations[0]
    : (locations.find((candidate) => candidate.address) ?? locations[0])
  const address = location?.address
  if (!address) return null

  const street = [text(address.address_1), text(address.address_2)].filter(Boolean).join(' ')
  const postalCode = text(address.postal_code)
  const city = text(address.city)
  const phone = text(address.phone)
  if (!street || !postalCode || !city || !phone) return null

  const contact = await contactOf(container)
  return {
    name: text(address.company) ?? options.senderName,
    street,
    postal_code: postalCode,
    city,
    phone: normalizePhone(phone),
    email: contact?.email ?? null,
  }
}
