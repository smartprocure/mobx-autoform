import _ from 'lodash/fp'
import { buildFieldPath, tokenizePath } from './util'

it('tokenizePath', () => {
  expect(tokenizePath()).toEqual([])
  expect(tokenizePath([])).toEqual([])
  expect(tokenizePath('')).toEqual([])
  expect(tokenizePath(0)).toEqual(['0'])
  expect(tokenizePath('0')).toEqual(['0'])
  expect(tokenizePath('a.["b.c"].0.d')).toEqual(['a', '["b.c"]', '0', 'd'])
  expect(tokenizePath('["a.b"]')).toEqual(['["a.b"]'])
})

it('buildFieldPath', () => {
  expect(buildFieldPath()).toEqual([])
  let path = ['a', '["b.c"]', 0, 'd']
  let result = ['a', 'fields', '["b.c"]', 'fields', '0', 'fields', 'd']
  expect(buildFieldPath(path)).toEqual(result)
  expect(buildFieldPath(_.join('.', path))).toEqual(result)
})
