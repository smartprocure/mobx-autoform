import F from 'futil'
import _ from 'lodash/fp'
import { toJS } from 'mobx'

export let tokenizePath = path =>
  _.map(
    _.toString,
    !_.isNumber(path) && _.isEmpty(path)
      ? []
      : _.isArray(path)
      ? path
      : // eslint-disable-next-line
        _.toString(path).split(/\.(?![^\[]+\])/g)
  )

export let joinPaths = _.flow(
  _.castArray,
  _.map(_.toString),
  _.map(x => (x.includes('.') && !x.includes('[') ? `["${x}"]` : x)),
  _.join('.')
)

export let buildPath = (x, xk, p, pk) =>
  _.map(_.toString, [xk, ...pk].reverse().slice(1))

export let pickFields = (node, paths = []) => {
  let flat = F.flattenTree(x => x.fields)((...x) =>
    _.join('.', buildPath(...x))
  )(node)
  paths = _.compact(paths)
  return _.isEmpty(paths) ? _.omit('', flat) : _.pick(paths, flat)
}

let reduceTreePost = (next = F.traverse) =>
  _.curry((f, result, tree) => {
    F.walk(next)(_.noop, (...x) => {
      result = f(result, ...x)
    })(tree)
    return result
  })

let filterCollection = _.curryN(2, (fn, x) =>
  _.isPlainObject(x)
    ? _.pickBy(fn, x)
    : _.isArray(x)
    ? _.filter(fn, x)
    : undefined
)

let isLeave = _.negate(F.isTraversable)

export let filterTree = _.curryN(2, (fn, v) =>
  reduceTreePost(filterCollection(fn))((acc, x, ...args) =>
    isLeave(x) ? F.setOn(buildPath(x, ...args), x, acc) : acc
  )(_.isArray(v) ? [] : _.isPlainObject(v) ? {} : v)(v)
)

export let toJSRecurse = x => toJS(x, { recurseEverything: true })
