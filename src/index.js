import F from 'futil'
import _ from 'lodash/fp'
import {
  observable,
  extendObservable,
  toJS,
  isObservable,
  isObservableArray,
  isObservableObject,
} from 'mobx'
import * as validators from './validators'
import { flattenFields, buildFieldPath, tokenizePath, hasNumber } from './util'
export { validators }

let clone = x => (isObservable(x) ? observable(toJS(x)) : _.cloneDeep(x))
let unmerge = _.flow(F.simpleDiff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))

let getField = (path, node) =>
  _.isEmpty(path) ? node : _.get(buildFieldPath(path), node)

let setField = (path, field, node) => {
  let fieldPath = buildFieldPath(path)
  if (_.isEmpty(fieldPath)) extendObservable(node, field)
  else F.setOn(fieldPath, field, node)
}

export default ({
  fields,
  submit,
  validate = validators.functions,
  afterInitField = x => x,
}) => {
  let baseNode = clone({
    value: _.mapValues('value', fields),
    fields: _.mapValues(_.omit('value'), fields),
    errors: {},
  })

  let initTree = (field, fieldValue, fieldPath = []) =>
    F.reduceTree((node, key) => (_.isNumber(key) ? node : node.fields))(
      (tree, node, key, parents, parentsKeys) => {
        let path = [key, ...parentsKeys].reverse().slice(1)
        // Array items are not fields
        if (_.isNumber(key)) return tree
        // If items is present, there are nested array fields
        if (node.items)
          node.fields = _.times(
            () => node.items,
            _.size(F.aliasIn(path, fieldValue))
          )
        let fullPath = [...fieldPath, ...path]
        // Root node
        if (_.isEmpty(key)) return initField(node, fullPath)
        // Set new field on tree
        setField(path, initField({ ...node, field: key }, fullPath), tree)
        return tree
      }
    )({})(field)

  let initField = (field, fieldPath) => {
    let pushNewField = () =>
      node.fields.push(
        F.mapValuesIndexed(
          (x, field) =>
            initField({ ...x, field }, [
              ...fieldPath,
              _.toString(node.value.length - 1),
              field,
            ]),
          node.items
        )
      )
    let dotPath = _.join('.', fieldPath)
    let node = observable({
      ...field,
      get isValid() {
        return _.isEmpty(node.errors)
      },
      get isDirty() {
        return changed(
          toJS(_.get(['value', ...fieldPath], baseNode)),
          toJS(_.get(['value', ...fieldPath], form))
        )
      },
      getField: fieldPath => getField(fieldPath, node),
      reset() {
        node.value = clone(_.get(['value', ...fieldPath], baseNode))
        node.errors = clone(
          _.get(_.join('.', ['errors', ...fieldPath]), baseNode)
        )
        node.fields = initTree(
          getField(fieldPath, baseNode),
          node.value,
          fieldPath
        ).fields
      },
      clean() {
        F.setOn(['value', ...fieldPath], clone(node.value), baseNode)
        F.setOn(['errors', ...fieldPath], clone(node.errors), baseNode)
        F.setOn(['fields', ...fieldPath], toJS(node.fields), baseNode) // Will omit setters/getters
      },
      validate(fields) {
        let flat = flattenFields(node)
        let picked = _.isEmpty(fields) ? flat : _.pick(fields, flat)
        if (_.isEmpty(picked)) picked = { [dotPath]: node }
        else if (dotPath) picked = _.mapKeys(k => `${dotPath}.${k}`, picked)
        form.errors = {
          ..._.omit(_.keys(picked), form.errors),
          ...validate(form, picked),
        }
        return form.errors
      },
      add(x) {
        if (isObservableArray(node.fields)) {
          node.value.push(observable(x))
          pushNewField()
        } else if (isObservableObject(node.fields)) {
          extendObservable(node.value, F.compactObject(_.mapValues('value', x)))
          extendObservable(
            node.fields,
            F.mapValuesIndexed(
              (x, field) => initField({ ...x, field }, [...fieldPath, field]),
              x
            )
          )
        } else F.throws('No fields or items defined')
      },
      remove(x) {
        let parentPath = _.isString(x)
          ? tokenizePath(x)
          : _.isNumber(x)
          ? [_.toString(x)]
          : x
        let fieldPath = parentPath.splice(parentPath.length - 1)
        // If last token of the parent fieldPath is a digit, move it to the child
        // fieldPath, since array items are not fields
        if (hasNumber(_.last(parentPath))) {
          fieldPath = [
            ...parentPath.splice(parentPath.length - 1),
            ...fieldPath,
          ]
        }
        // If parentPath is not empty, call remove on the correct node
        if (!_.isEmpty(parentPath)) node.getField(parentPath).remove(fieldPath)
        // Remove array item
        else if (fieldPath.length === 1 && hasNumber(fieldPath[0])) {
          let index = parseInt(fieldPath[0])
          node.value.splice(index, 1)
          _.times(pushNewField, node.fields.splice(index).length - 1)
        }
        // Remove object field. Field can be inside an array item, so the fieldPath
        // could be "0.name" and this will still  work
        else {
          F.unsetOn(fieldPath, node.value)
          F.unsetOn(fieldPath, node.fields)
        }
      },
    })
    // Root node doesn't have a field set
    if (field.field) {
      extendObservable(node, {
        label: field.label || _.startCase(field.field),
        get value() {
          return _.get(fieldPath, form.value)
        },
        set value(x) {
          F.setOn(fieldPath, x, form.value)
        },
        get errors() {
          return _.getOr([], dotPath, form.errors)
        },
        set errors(x) {
          F.setOn(dotPath, x, form.errors)
        },
      })
    }
    return afterInitField(node, field)
  }

  let form = observable(initTree(baseNode, baseNode.value))
  return extendObservable(form, {
    getSnapshot: () => F.flattenObject(toJS(form.value)),
    getNestedSnapshot: () => F.unflattenObject(toJS(form.value)),
    getPatch: () =>
      _.omitBy(_.isNil, unmerge(toJS(baseNode.value), toJS(form.value))),
    submit: Command(() => {
      // Do this after reset as well
      form.submit.state.error = null
      if (_.isEmpty(form.validate())) return submit(form.getSnapshot(), form)
      throw 'Validation Error'
    }),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
  })
}
