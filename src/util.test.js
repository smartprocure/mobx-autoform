import { tokenizePath, safeJoinPaths, gatherFormValues } from './util'

it('tokenizePath', () => {
  expect(tokenizePath()).toEqual([])
  expect(tokenizePath([])).toEqual([])
  expect(tokenizePath('')).toEqual([])
  expect(tokenizePath([0])).toEqual(['0'])
  expect(tokenizePath(0)).toEqual(['0'])
  expect(tokenizePath('0')).toEqual(['0'])
  expect(tokenizePath('a.["b.c"].0.d')).toEqual(['a', '["b.c"]', '0', 'd'])
  expect(tokenizePath('["a.b"]')).toEqual(['["a.b"]'])
})

it('safeJoinPaths', () => {
  expect(safeJoinPaths()).toEqual('')
  expect(safeJoinPaths(['a', '["b.c"]', 0, 'd'])).toEqual('a.["b.c"].0.d')
  expect(safeJoinPaths(['a', 'b.c', 0, 'd'])).toEqual('a.["b.c"].0.d')
})

it('gatherFormValues', () => {
  expect(
    gatherFormValues({
      fields: {
        'a.b': { fields: [{ value: 1 }, { value: 2 }] },
        c: { fields: { d: {} } },
        e: { value: [1, 2], fields: [{ value: 1 }, { value: 2 }] },
      },
    })
  ).toStrictEqual({ 'a.b': [1, 2], c: { d: undefined }, e: [1, 2] })
})
