import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable, toJS } from 'mobx'
import { functions } from './validators'
let unmerge = _.flow(
  F.simpleDiff,
  _.mapValues('to')
)
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))

let values = _.mapValues('value')
let Form = ({ afterInitField = x => x, validate = functions, ...config }) => {
  let initField = (x, field) => {
    let node = observable({
      field,
      label: x.label || _.startCase(field),
      // in case no value is provided, avoids controlled vs uncontrolled warning
      // and need for mobx 4
      value: _.getOr('', 'value', x),
      get errors() {
        return form.errors[field] || []
      },
      get isValid() {
        return !node.errors.length
      },
      get isDirty() {
        return changed(toJS(node.value), x.value)
      },
      reset() {
        node.value = F.when(_.isUndefined, '')(x.value)
      },
      validate: () => form.validate([field]),
      clean() {
        x.value = node.value
      },
      ..._.omit('value', x),
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
      form.errors = {}
      form.submit.state.error = null
      if (_.isEmpty(form.validate()))
        return config.submit(form.getSnapshot(), form)
      else throw 'Validation Error'
    }),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
    reset() {
      _.invokeMap('reset', form.fields)
      form.errors = {}
      form.submit.state.error = null
    },
    get isDirty() {
      return _.some('isDirty', form.fields)
    },
    clean() {
      _.invokeMap('clean', form.fields)
    },
    // Validation
    errors: {},
    get isValid() {
      return _.isEmpty(form.errors)
    },
    validate: fields =>
      (form.errors = fields
        ? { ..._.omit(fields, form.errors), ...validate(form, fields) }
        : validate(form)),
    add: x => extendObservable(form.fields, F.mapValuesIndexed(initField, x)),
  })
  return form
}

export default Form
