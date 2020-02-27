import { splitAt } from './futil'

it('splitAt', () => {
  expect(splitAt(-3, [1, 2])).toEqual([[], [1, 2]])
  expect(splitAt(-2, [1, 2])).toEqual([[], [1, 2]])
  expect(splitAt(-1, [1, 2])).toEqual([[1], [2]])
  expect(splitAt(-0, [1, 2])).toEqual([[], [1, 2]])
  expect(splitAt(0, [1, 2])).toEqual([[], [1, 2]])
  expect(splitAt(1, [1, 2])).toEqual([[1], [2]])
  expect(splitAt(2, [1, 2])).toEqual([[1, 2], []])
  expect(splitAt(3, [1, 2])).toEqual([[1, 2], []])
})

