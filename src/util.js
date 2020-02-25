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

export let toJSDeep = x => toJS(x, { recurseEverything: true })
