import { tokenizePath, safeJoinPaths } from './util'

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
