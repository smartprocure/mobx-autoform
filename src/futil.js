import _ from 'lodash/fp'
import F from 'futil'

export let treePath = (x, xk, p, pk) =>
  _.map(_.toString, [xk, ...pk].reverse().slice(1))

export let omitByPrefixes = (prefixes, obj) =>
  F.pickByIndexed((x, k) => !_.some(p => _.startsWith(p, k), prefixes), obj)

export let pickByPrefixes = (prefixes, obj) =>
  F.pickByIndexed((x, k) => _.some(p => _.startsWith(p, k), prefixes), obj)

export let reduceTreePost = (next = F.traverse) =>
  _.curry((f, result, tree) => {
    F.walk(next)(_.noop, (...x) => {
      result = f(result, ...x)
    })(tree)
    return result
  })
