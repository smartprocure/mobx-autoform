import { tokenizePath, joinPaths, pickFields } from './util'

it('tokenizePath', () => {
  expect(tokenizePath()).toEqual([])
  expect(tokenizePath([])).toEqual([])
  expect(tokenizePath('')).toEqual([])
  expect(tokenizePath(0)).toEqual(['0'])
  expect(tokenizePath('0')).toEqual(['0'])
  expect(tokenizePath('a.["b.c"].0.d')).toEqual(['a', '["b.c"]', '0', 'd'])
  expect(tokenizePath('["a.b"]')).toEqual(['["a.b"]'])
})

it('joinPaths', () => {
  expect(joinPaths()).toEqual('')
  expect(joinPaths(['a', '["b.c"]', 0, 'd'])).toEqual('a.["b.c"].0.d')
  expect(joinPaths(['a', 'b.c', 0, 'd'])).toEqual('a.["b.c"].0.d')
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
  expect(pickFields({})).toEqual({})
  expect(pickFields(tree)).toEqual({
    a: tree.fields.a,
    'a.a.a': {},
    'a.a.b': {},
  })
  expect(pickFields(tree, 'a.a.a')).toEqual({ 'a.a.a': {} })
})
