import { type Row, withoutReturnMethods } from '../order-summary'

const delivery: Row = { name: 'Kurier DPD', shipping_option_id: 'so_dpd' }
const back: Row = { name: 'Zwrot we własnym zakresie', shipping_option_id: 'so_return' }

describe('withoutReturnMethods', () => {
  it('drops the method of a return option, the delivery stays', () => {
    expect(withoutReturnMethods([delivery, back], new Set(['so_return']))).toEqual([delivery])
  })

  it('no return option: the list stays as it is', () => {
    expect(withoutReturnMethods([delivery, back], new Set())).toEqual([delivery, back])
  })

  it('a method without an option id is not a return method', () => {
    const custom: Row = { name: 'Odbiór osobisty', shipping_option_id: null }

    expect(withoutReturnMethods([custom, back], new Set(['so_return']))).toEqual([custom])
  })
})
