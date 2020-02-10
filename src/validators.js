import F from 'futil'
import _ from 'lodash/fp'
import { toJS } from 'mobx'

let maybeLimitFields = fields => (fields ? _.pick(fields) : x => x)

export let validatorJS = Validator => (form, fields) => {
  let validation = new Validator(
    form.getSnapshot(),
    _.flow(
      maybeLimitFields(fields),
      _.mapValues(x => toJS(x.rules)),
      F.compactObject
    )(form.flatFields)
  )
  validation.setAttributeNames(_.mapValues('label', form.fields))
  return validation.fails() ? validation.errors.all() : {}
}

export let functions = (form, fields) => {
  let snapshot = form.getSnapshot()
  return _.flow(
    maybeLimitFields(fields),
    F.mapValuesIndexed(({ validator = () => {} }, field) =>
      validator(snapshot[field])
    ),
    F.compactObject
  )(form.flatFields)
}
