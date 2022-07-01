import { observable, reaction, configure } from 'mobx'
import { get, set, toJS } from './mobx'

configure({ enforceActions: 'never', useProxies: 'never' })

describe('get/set', () => {
  it.each([
    ['non-existing value', { a: 1 }],
    ['existing value', { a: { b: { c: 1 } } }],
    ['overwrites existing primitive', { a: { b: 2 } }],
  ])('%s', (description, value) => {
    let o = observable(value)
    let fn = jest.fn()
    let dispose = reaction(
      () => get(['a', 'b', 'c'], o),
      x => fn(x)
    )
    set(['a', 'b', 'c'], 2, o)
    expect(fn).toHaveBeenCalledWith(2)
    dispose()
  })
})

describe('toJS', () => {
  it('should clone nested properties', () => {
    let obj = observable({ a: { b: 2 }, c: 3 })
    let actual = toJS(obj)
    obj.a.b = 10
    expect(actual.a.b).not.toEqual(obj.a.b)
  })
  it('should clone top-level observable', () => {
    let actual = toJS(observable({ a: { b: 2 }, c: 3 }))
    let expected = { a: { b: 2 }, c: 3 }
    expect(actual).toEqual(expected)
  })
  it('should clone nested observable', () => {
    let actual = toJS({ a: observable({ b: 2 }), c: 3 })
    let expected = { a: { b: 2 }, c: 3 }
    expect(actual).toEqual(expected)
  })
  it('should evaluate getter', () => {
    let actual = toJS({
      a: observable({ b: 2 }),
      get c() {
        return 3
      },
    })
    let expected = { a: { b: 2 }, c: 3 }
    expect(actual).toEqual(expected)
  })
  it('should not modify original function', () => {
    let c = () => 3
    let actual = toJS({ a: observable({ b: 2 }), c })
    let expected = { a: { b: 2 }, c }
    expect(actual).toEqual(expected)
  })
})
