import F from 'futil'
import _ from 'lodash/fp'

export let splitAt = (i, x) => [x.slice(0, i), x.slice(i, x.length)]

// Until https://github.com/smartprocure/futil-js/pull/315 gets merged
export let simpleDiff = (original, deltas) => {
  let o = F.flattenObject(original)
  return _.flow(
    F.flattenObject,
    F.mapValuesIndexed((to, field) => ({ from: o[field], to })),
    _.omitBy(x => _.isEqual(x.from, x.to))
  )(deltas)
}

export let treePath = (x, xk, p, pk) =>
  _.map(_.toString, [xk, ...pk].reverse().slice(1))
