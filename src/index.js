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

  let initTree = (config, currentValue, currentPath = []) =>
    F.reduceTree((node, key) => (_.isNumber(key) ? node : node.fields))(
      (tree, node, key, parents, parentsKeys) => {
        let path = [key, ...parentsKeys].reverse().slice(1)
        // If items is present, there are nested array fields
        if (node.items)
          node.fields = _.times(
            () => node.items,
            _.size(F.aliasIn(path, currentValue))
          )
        if (_.isNumber(key)) return tree // Array items are not fields
        let fullPath = [...currentPath, ...path]
        if (_.isEmpty(key)) return initField(node, fullPath)
        setField(path, initField({ ...node, field: key }, fullPath), tree)
        return tree
      }
    )({})(config)

  let initField = (config, path) => {
    let pushNewField = () =>
      node.fields.push(
        F.mapValuesIndexed(
          (x, field) =>
            initField({ ...x, field }, [
              ...path,
              _.toString(node.value.length - 1),
              field,
            ]),
          node.items
        )
      )
    let dotPath = _.join('.', path)
    let node = observable({
      ...config,
      get isValid() {
        return _.isEmpty(node.errors)
      },
      get isDirty() {
        return changed(
          toJS(_.get(['value', ...path], baseNode)),
          toJS(_.get(['value', ...path], form))
        )
      },
      getField: path => getField(path, node),
      reset() {
        node.value = clone(_.get(['value', ...path], baseNode))
        node.errors = clone(_.get(_.join('.', ['errors', ...path]), baseNode))
        node.fields = initTree(
          getField(path, baseNode),
          node.value,
          path
        ).fields
      },
      clean() {
        F.setOn(['value', ...path], clone(node.value), baseNode)
        F.setOn(['errors', ...path], clone(node.errors), baseNode)
        F.setOn(['fields', ...path], toJS(node.fields), baseNode) // Will omit setters/getters
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
              (x, field) => initField({ ...x, field }, [...path, field]),
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
        let path = parentPath.splice(parentPath.length - 1)
        // If last token of the parent path is a digit, move it to the child
        // path, since array items are not fields
        if (hasNumber(_.last(parentPath))) {
          path = [...parentPath.splice(parentPath.length - 1), ...path]
        }
        // If parentPath is not empty, call remove on the correct node
        if (!_.isEmpty(parentPath)) node.getField(parentPath).remove(path)
        // Remove array item
        else if (path.length === 1 && hasNumber(path[0])) {
          let index = parseInt(path[0])
          node.value.splice(index, 1)
          _.times(pushNewField, node.fields.splice(index).length - 1)
        }
        // Remove object field. Field can be inside an array item, so the path
        // could be "0.name" and this will still  work
        else {
          F.unsetOn(path, node.value)
          F.unsetOn(path, node.fields)
        }
      },
    })
    // Root node doesn't have a field set
    if (config.field) {
      extendObservable(node, {
        label: config.label || _.startCase(config.field),
        get value() {
          return _.get(path, form.value)
        },
        set value(x) {
          F.setOn(path, x, form.value)
        },
        get errors() {
          return _.getOr([], dotPath, form.errors)
        },
        set errors(x) {
          F.setOn(dotPath, x, form.errors)
        },
      })
    }
    return afterInitField(node, config)
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
