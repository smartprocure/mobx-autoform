import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable, toJS, remove } from 'mobx'
import * as validators from './validators'
export { validators }

let unmerge = _.flow(F.simpleDiff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))
let values = _.flow(_.mapValues('value'), F.flattenObject)

export default ({
  fields,
  submit,
  validate = validators.functions,
  afterInitField = x => x,
}) => {
  let addMissingSubfields = node => {
    let addSubfield = index =>
      extendObservable(
        node.fields,
        _.flow(
          _.mapKeys(k => `${index}.${k}`),
          F.mapValuesIndexed((x, field) => initField(x, field, node))
        )(node.arrayFields)
      )
    let startIndex = _.flow(_.keys, _.map(parseInt), _.max, x =>
      _.isNil(x) ? 0 : x + 1
    )(node.fields)
    let endIndex = node.value.length
    _.each(addSubfield, _.range(startIndex, endIndex))
  }

  let initField = ({ value = '', ...x }, field, parent) => {
    let initialValue = parent ? _.get(field, parent.value) : _.cloneDeep(value)
    let fieldPath = F.dotJoin([_.get('field', parent), field])
    let node = observable({
      field,
      label: x.label || _.startCase(field),
      get errors() {
        return form.errors[fieldPath] || []
      },
      get isValid() {
        return !node.errors.length
      },
      get isDirty() {
        return changed(toJS(node.value), toJS(initialValue))
      },
      reset() {
        node.value = F.when(_.isUndefined, '')(initialValue)
      },
      validate: () => form.validate([fieldPath]),
      clean() {
        initialValue = node.value
      },
      // Value getter/setter ensure two-way binding between the parent's value
      // and this node's value
      get value() {
        return parent ? _.get(field, parent.value) : initialValue
      },
      set value(x) {
        parent ? F.setOn(field, x, parent.value) : (initialValue = x)
      },
      ...x,
    })

    if (x.arrayFields) {
      // Extend node with methods that deal with nested array fields
      extendObservable(node, {
        fields: {},
        add(x) {
          node.value.push(x)
          addMissingSubfields(node)
        },
        removeIndex(index) {
          node.value.splice(index, 1)
          F.eachIndexed(
            (v, k) => parseInt(k) >= index && remove(node.fields, k),
            node.fields
          )
          addMissingSubfields(node)
        },
        remove: x => node.removeIndex(_.findIndex(_.isEqual(x), node.value)),
      })
      addMissingSubfields(node)
    }

    return afterInitField(node, x)
  }

  let form = observable({
    initField,
    fields: {},
    get flatFields() {
      return _.omit('', F.flattenTree(x => x.fields)()(form))
    },
    getSnapshot: () => values(form.fields),
    getNestedSnapshot: () => F.unflattenObject(values(form.fields)),
    getPatch: () =>
      _.omitBy(_.isNil, unmerge(values(fields), values(form.fields))),
    submit: Command(() => {
      form.errors = {}
      form.submit.state.error = null
      if (_.isEmpty(form.validate())) return submit(form.getSnapshot(), form)
      else throw 'Validation Error'
    }),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
    reset() {
      _.invokeMap('reset', form.flatFields)
      form.errors = {}
      form.submit.state.error = null
    },
    get isDirty() {
      return _.some('isDirty', form.flatFields)
    },
    clean() {
      _.invokeMap('clean', form.flatFields)
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
    add: x =>
      extendObservable(
        form.fields,
        F.mapValuesIndexed((x, field) => initField(x, field), x)
      ),
  })
  form.add(fields)
  return form
}
