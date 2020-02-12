import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable } from 'mobx'
import * as validators from './validators'
import { flattenFields, fieldPath } from './util'

let unmerge = _.flow(F.simpleDiff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))

let Form = ({
  fields,
  submit,
  validate = validators.functions,
  afterInitField = x => x,
}) => {
  let initialNode = _.cloneDeep({
    fields,
    value: _.mapValues('value', fields),
  })
  let currentNode = _.cloneDeep(initialNode)

  let addArraySubFields = node =>
    _.each(index => {
      let items = F.mapValuesIndexed(
        (x, name) =>
          _.merge(x, {
            field: `${index}.${name}`,
            path: [...node.path, index, name],
          }),
        node.items
      )
      node.fields.push(initFields(items))
    }, _.range(node.fields.length, _.get('value.length', node)))

  let addSubFields = (node, v) =>
    extendObservable(node.fields, initFields(v, node.path))

  let initFields = (fields, parentPath = []) =>
    F.mapValuesIndexed(
      (x, name) =>
        initField({
          ...x,
          field: x.field || name,
          path: x.path || [...parentPath, name],
        }),
      fields
    )

  let initField = config => {
    let node = observable({
      label: config.label || _.startCase(config.field),
      get errors() {
        return form.errors[_.join('.', node.path)] || []
      },
      get isValid() {
        return !node.errors.length
      },
      get isDirty() {
        return changed(_.get(node.path, initialNode.value), node.value)
      },
      reset() {
        let initialValue = _.get(node.path, initialNode.value)
        if (_.isUndefined(initialValue)) {
          currentNode.value = _.unset(node.path, currentNode.value)
        } else {
          F.setOn(node.path, _.cloneDeep(initialValue), currentNode.value)
          if (config.items) {
            node.fields = []
            addArraySubFields(node)
          } else {
            node.fields = {}
            addSubFields(
              node,
              _.get([...fieldPath(node.path), 'fields'], initialNode)
            )
          }
        }
      },
      validate: () => form.validate([_.join('.', node.path)]),
      clean() {
        F.setOn(node.path, _.cloneDeep(node.value), initialNode.value)
      },
      ..._.omit('path', config),
      fields: config.items ? [] : {},
      getField: path => _.get(fieldPath(path), node),
      get value() {
        return _.get(node.path, currentNode.value)
      },
      set value(x) {
        F.setOn(node.path, x, currentNode.value)
      },
      add(v) {
        if (config.items) {
          node.value.push(v)
          addArraySubFields(node)
        } else {
          F.mergeOn(node.value, _.mapValues('value', v))
          addSubFields(node, v)
        }
      },
      remove(x) {
        if (config.items) {
          console.error('TODO', x)
        } else {
          console.error('TODO', x)
        }
      },
    })
    node.path = config.path // To not make it an observable
    if (config.items) addArraySubFields(node)
    else addSubFields(node, config.fields)
    return afterInitField(node, config)
  }

  let form = observable({
    fields: initFields(currentNode.fields),
    getField: path => _.get(fieldPath(path), form),
    getValue: path => _.get(path, currentNode.value),
    getSnapshot: () => F.flattenObject(currentNode.value),
    getNestedSnapshot: () => F.unflattenObject(currentNode.value),
    getPatch: () =>
      _.omitBy(_.isNil, unmerge(initialNode.value, currentNode.value)),
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
    validate(fields) {
      let flatFields = flattenFields(form)
      form.errors = fields
        ? {
            ..._.omit(fields, form.errors),
            ...validate(form, _.pick(fields, flatFields)),
          }
        : validate(form, flatFields)
      return form.errors
    },
    add: x => addSubFields(form, x),
  })
  return form
}

export default Form
export { validators }
