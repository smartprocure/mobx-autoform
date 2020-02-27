import { tokenizePath, safeJoinPaths, pickFields } from './util'

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

it('pickFields', () => {
  let tree = {
    fields: {
      a: {
        fields: {
          'a.a': {},
          'a.b': {},
        },
      },
    },
  }
  let result = {
    a: tree.fields.a,
    'a.a.a': {},
    'a.a.b': {},
  }
  expect(pickFields(tree)).toEqual(result)
  expect(pickFields(tree, [])).toEqual(result)
  expect(pickFields(tree, [''])).toEqual(result)
  expect(pickFields(tree, ['a'])).toEqual(result)
  expect(pickFields(tree, ['a.a'])).toEqual({
    'a.a.a': {},
    'a.a.b': {},
  })
  expect(pickFields(tree, ['a.a.a'])).toEqual({ 'a.a.a': {} })
})
