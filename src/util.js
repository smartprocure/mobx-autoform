import _ from 'lodash/fp.js'
import { reduceTreePost, treePath } from './futil.js'

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

// Walk tree of fields and gather values. If the field has no value,
// still set a key for the field but with a value of undefined
// TODO: futil F.mapTree
export let gatherFormValues = form =>
  reduceTreePost(x => x[form.keys.fields])((tree, x, ...xs) =>
    // Only walk leaf nodes
    !_.isEmpty(x[form.keys.fields])
      ? tree
      : _.set(treePath(x, ...xs), x.value, tree)
  )({})(form)
