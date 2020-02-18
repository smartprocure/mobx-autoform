import F from 'futil'
import _ from 'lodash/fp'

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
  [_.toString(xk), ...pk].reverse().slice(1)

export let pickFields = (node, fields = []) => {
  let flat = F.flattenTree(x => x.fields)((...x) =>
    _.join('.', buildPath(...x))
  )(node)
  return _.isEmpty(fields) ? _.omit('', flat) : _.pick(fields, flat)
}
