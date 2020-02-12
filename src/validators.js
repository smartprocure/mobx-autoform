import F from 'futil'
import _ from 'lodash/fp'
import { toJS } from 'mobx'

export let validatorJS = Validator => (form, fields) => {
  let validation = new Validator(
    form.getSnapshot(),
    _.flow(
      _.mapValues(x => toJS(x.rules)),
      F.compactObject
    )(fields)
  )
  validation.setAttributeNames(_.mapValues('label', form.flatFields))
  return validation.fails() ? validation.errors.all() : {}
}

export let functions = (form, fields) => {
  let snapshot = form.getSnapshot()
  return _.flow(
    F.mapValuesIndexed(({ validator = () => {} }, field) =>
      validator(snapshot[field])
    ),
    F.compactObject
  )(fields)
}
