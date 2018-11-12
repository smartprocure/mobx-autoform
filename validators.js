import F from 'futil'
import _ from 'lodash/fp'

// Validators take the signature:
//   form => {field: [errors], ...}

export let validatorJS = Validator => form => {
  let validation = new Validator(
    form.getSnapshot(),
    _.mapValues('rules', form.fields)
  )
  validation.setAttributeNames(_.mapValues('label', form.fields))
  return validation.fails() ? validation.errors.all() : {}
}

export let functions = form => {
  let snapshot = form.getSnapshot()
  return _.flow(
    F.mapValuesIndexed(({ validate = () => {} }, field) =>
      validate(snapshot[field])
    ),
    F.compactObject
  )(form.fields)
}
