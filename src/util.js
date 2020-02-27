import F from 'futil'
import _ from 'lodash/fp'
import { treePath } from './futil'

export let tokenizePath = path => {
  if (_.isNumber(path)) path = [_.toString(path)]
  else if (_.isEmpty(path)) path = []
  // eslint-disable-next-line
  else if (_.isString(path)) path = path.split(/\.(?![^\[]+\])/g)
  return _.map(_.toString, path)
}

export let safeJoinPaths = _.flow(
  _.map(_.toString),
  _.map(x => (x.includes('.') && !x.includes('[') ? `["${x}"]` : x)),
  _.join('.')
)

export let pickFields = (node, paths = []) => {
  let flat = F.flattenTree(x => x.fields)((...x) =>
    _.join('.', treePath(...x))
  )(node)
  paths = _.compact(paths)
  return _.isEmpty(paths)
    ? _.omit('', flat)
    : F.pickByIndexed((x, k) => _.some(p => _.startsWith(p, k), paths), flat)
}
