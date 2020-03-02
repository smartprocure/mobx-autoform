import _ from 'lodash/fp'

export let splitAt = (i, x) => [x.slice(0, i), x.slice(i, x.length)]

export let treePath = (x, xk, p, pk) =>
  _.map(_.toString, [xk, ...pk].reverse().slice(1))
