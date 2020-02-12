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

export let fieldPath = path => {
  let sections = path
  if (_.isString(path)) {
    // Preserve quoted paths that we should not split on dots. Ex: 'foo."bar.baz"'
    sections = _.split('"', path)
    if (sections.length === 1) {
      // No quoted sections were present. Split as usual
      sections = _.flatMap(_.split('.'), sections)
    } else {
      // Sections that start or end with a dot are the unquoted ones
      sections = _.flatMap(
        x =>
          _.startsWith('.', x) || _.endsWith('.', x) ? _.split('.', x) : [x],
        sections
      )
    }
  }
  // If we've got index accessing (ex: 'foo.0.bar'), we don't append ".fields"
  sections = _.flatMap(
    x => (_.isNaN(parseInt(x)) ? [x, 'fields'] : [x]),
    _.compact(sections)
  )
  return _.isEmpty(sections) ? [] : ['fields', ..._.dropRight(1, sections)]
}
