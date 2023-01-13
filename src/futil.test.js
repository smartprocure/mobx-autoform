import F from 'futil'
import { omitByPrefixes, pickByPrefixes, reduceTreePost } from './futil.js'

it('reduceTreePost', () => {
  let x = {
    a: 1,
    b: {
      c: 2,
    },
  }
  expect(reduceTreePost()((r, i) => F.push(i, r), [], x)).toStrictEqual([
    x.a,
    x.b.c,
    x.b,
    x,
  ])
})

it('omitByPrefixes', () => {
  expect(
    omitByPrefixes(['a', 'b'], {
      a: 1,
      'a.b.c': 1,
      b: 2,
      'b.c.d': 2,
      'd.e.f': 3,
    })
  ).toEqual({ 'd.e.f': 3 })
})

it('pickByPrefixes', () => {
  expect(
    pickByPrefixes(['a', 'b'], {
      a: 1,
      'a.b.c': 1,
      b: 2,
      'b.c.d': 2,
      'd.e.f': 3,
    })
  ).toEqual({
    a: 1,
    'a.b.c': 1,
    b: 2,
    'b.c.d': 2,
  })
})
