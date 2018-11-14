import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable } from 'mobx'
import { functions } from './validators'
let unmerge = _.flow(
  F.simpleDiff,
  _.mapValues('to')
)
let changed = (x, y) => x !== y && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))

let values = _.mapValues('value')
let Form = ({ afterInitField = x => x, validate = functions, ...config }) => {
  let initField = (x, field) => {
    let node = observable({
      field,
      label: x.label || _.startCase(field),
      value: '', // in case no value is provided, avoids controlled vs uncontrolled warning and need for mobx 4
      get errors() {
        return form.errors[field] || []
      },
      get isValid() {
        return !node.errors.length
      },
      get isDirty() {
        return changed(node.value, x.value)
      },
      reset() {
        node.value = F.when(_.isUndefined, '')(x.value)
      },
      validate: () => form.validate([field]),
      ...x,
    })
    return afterInitField(node, x)
  }
  let form = observable({
    initField,
    fields: F.mapValuesIndexed(initField, config.fields),
    getSnapshot: () => values(form.fields),
    getNestedSnapshot: () => F.unflattenObject(values(form.fields)),
    getPatch: () =>
      _.omitBy(_.isNil, unmerge(values(config.fields), values(form.fields))),
    submit: Command(() => {
      if (_.isEmpty(form.validate()))
        return config.submit(form.getSnapshot(), form)
      else throw 'Validation Error'
    }),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
    reset: () => _.invokeMap('reset', form.fields),
    get isDirty() {
      return _.some('isDirty', form.fields)
    },
    // Validation
    errors: {},
    get isValid() {
      return _.isEmpty(form.errors)
    },
    validate: fields => (form.errors = validate(form, fields)),
    add: x => extendObservable(form.fields, F.mapValuesIndexed(initField, x)),
  })
  return form
}

export default Form
