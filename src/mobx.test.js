import { observable, reaction } from 'mobx'
import { get, set } from './mobx'

describe('get/set', () => {
  it.each([
    ['non-existing value', { a: 1 }],
    ['existing value', { a: { b: { c: 1 } } }],
    ['overwrites existing primitive', { a: { b: 2 } }],
  ])('%s', (description, value) => {
    let o = observable(value)
    let fn = jest.fn()
    let dispose = reaction(
      () => get('a.b.c', o),
      x => fn(x)
    )
    set('a.b.c', 2, o)
    expect(fn).toHaveBeenCalledWith(2)
    dispose()
  })
})
