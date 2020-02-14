import F from 'futil'
import _ from 'lodash/fp'
import { isObservableArray } from 'mobx'

let traverse = x => {
  if (isObservableArray(x.fields))
    return F.reduceIndexed(
      (acc, x, index) =>
        _.merge(
          acc,
          _.mapKeys(k => `${index}.${k}`, x)
        ),
      {},
      x.fields
    )
  return x.fields
}
export let flattenFields = _.flow(F.flattenTree(traverse)(), _.omit(''))

// Ex:
// - 'us."country.state".zip.0.street' -> ['us', 'country.state', 'zip', '0', 'street']
// - ['us', 'country.state', 'zip', '0', 'street'] returns unchanged
export let tokenizePath = path => {
  if (!path) return []
  if (!_.isArray(path)) {
    let tokens = path.split('"')
    let fn =
      // If there's only one token, it is safe to split
      tokens.length === 1
        ? _.split('.')
        : // tokens that start or end with a dot were not quoted previously and are
          // safe to split
          x =>
            _.startsWith('.', x) || _.endsWith('.', x) ? _.split('.', x) : [x]
    return _.compact(_.flatMap(fn, tokens))
  }
  return path
}

export let hasNumber = x => !_.isNaN(parseInt(x))

export let buildFieldPath = path =>
  _.reduce(
    (acc, x) => _.concat(acc, hasNumber(_.last(acc)) ? [x] : ['fields', x]),
    [],
    tokenizePath(path)
  )
