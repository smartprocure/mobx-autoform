import _ from 'lodash/fp'

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
