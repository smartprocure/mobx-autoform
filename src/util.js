import F from 'futil'
import _ from 'lodash/fp'

export let tokenizePath = path =>
  !_.isNumber(path) && _.isEmpty(path)
    ? []
    : _.isArray(path)
    ? path
    : // eslint-disable-next-line
      _.toString(path).split(/\.(?![^\[]+\])/g)

export let buildFieldPath = path =>
  _.compact(_.map(_.toString, F.intersperse('fields', tokenizePath(path))))
