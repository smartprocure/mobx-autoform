import F from 'futil'
import _ from 'lodash/fp.js'
import { toJS } from './mobx.js'

export let validatorJS = Validator => (form, fields) => {
  let validation = new Validator(
    toJS(_.mapValues('value', fields)),
    _.flow(
      _.mapValues(x => toJS(x.rules)),
      _.omitBy(_.isEmpty)
    )(fields)
  )
  validation.setAttributeNames(_.mapValues(form.keys.label, fields))
  return validation.fails() ? validation.errors.all() : {}
}

export let functions = (form, fields) =>
  _.flow(
    F.mapValuesIndexed(x => (x.validator || _.noop)(x.value, x, form)),
    _.omitBy(_.isEmpty)
  )(fields)
