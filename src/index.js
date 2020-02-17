import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable, toJS, isObservable } from 'mobx'
import * as validators from './validators'
import { buildFieldPath, tokenizePath } from './util'
export { validators }

let clone = x => (isObservable(x) ? observable(toJS(x)) : _.cloneDeep(x))
let unmerge = _.flow(F.simpleDiff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))
let joinPaths = (...paths) =>
  _.flow(
    _.map(x => (x.includes('.') && !x.includes('[') ? `["${x}"]` : x)),
    _.join('.')
  )(paths)
let getOrValue = (path, value) => _.getOr(value, path, value)

export default ({
  submit,
  validate = validators.functions,
  afterInitField = x => x,
  ...config
}) => {
  let buildPath = (node, key, parents, parentsKeys) =>
    [key, ...parentsKeys].reverse().slice(1)

  let initTree = (field, fieldValue, fieldPath = []) =>
    F.reduceTree(x => x.fields)((tree, node, key, parents, parentsKeys) => {
      let path = buildPath(node, key, parents, parentsKeys)
      if (node.items)
        node.fields = _.times(
          () => node.items,
          _.size(getOrValue(path, fieldValue))
        )
      let fullPath = [...fieldPath, ...path]
      if (_.isNil(key)) return initField(node, fullPath)
      F.setOn(
        buildFieldPath(path),
        initField({ ...node, field: key }, fullPath),
        tree.fields
      )
      return tree
    })({ fields: {} })(field)

  let initFields = (fields, fieldValue, fieldPath = []) =>
    F.mapValuesIndexed(
      (x, k) => initTree(x, fieldValue, [...fieldPath, k]),
      fields
    )

  let fieldMethods = (field, fieldPath = []) => {
    let node = observable({
      ...field,
      get isValid() {
        return _.isEmpty(node.errors)
      },
      get isDirty() {
        return changed(
          toJS(getOrValue(fieldPath, baseNode.value)),
          toJS(getOrValue(fieldPath, form.value))
        )
      },
      getField: path => _.get(joinPaths(...buildFieldPath(path)), node.fields),
      reset() {
        if (!_.isEmpty(fieldPath)) form.submit.state.error = null // Lil hack
        node.errors = clone(getOrValue(_.join('.', fieldPath), baseNode.errors))
        node.value = undefined
        F.unsetOn('fields', node)
        let baseValue = getOrValue(fieldPath, baseNode.value)
        let baseField = _.getOr(
          baseNode,
          buildFieldPath(fieldPath),
          baseNode.fields
        )
        if (baseField.items) {
          node.add(baseValue)
        } else if (baseField.fields) {
          node.add(
            F.mapValuesIndexed(
              (x, k) => F.compactObject({ ...x, value: _.get(k, baseValue) }),
              baseField.fields
            )
          )
        } else {
          node.value = baseValue
        }
      },
      clean() {
        F.setOn(['value', ...fieldPath], toJS(node.value), baseNode)
        F.setOn(['errors', ...fieldPath], toJS(node.errors), baseNode)
        F.setOn(['fields', ...fieldPath], toJS(node.fields), baseNode)
      },
      validate(fields) {
        let dotPath = _.join('.', fieldPath)
        let flat = F.flattenTree(x => x.fields)((...x) =>
          _.join('.', buildPath(...x))
        )(node)
        flat = _.omit('', flat)
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
        if (node.items) {
          F.defaultsOn({ value: observable([]), fields: observable([]) }, node)
          let lengthBefore = node.value.length
          node.value.push(..._.castArray(x))
          _.each(index => {
            let field = initTree(
              { ...node.items, field: index },
              node.value[index],
              [...fieldPath, index]
            )
            node.fields.push(field)
          }, _.range(lengthBefore, node.value.length))
        } else {
          F.defaultsOn({ fields: observable({}), value: observable({}) }, node)
          extendObservable(node.value, F.compactObject(_.mapValues('value', x)))
          extendObservable(node.fields, initFields(x, node.value, fieldPath))
        }
      },
      remove(x) {
        let parentPath = tokenizePath(x)
        let path = parentPath.splice(parentPath.length - 1)
        if (!_.isEmpty(parentPath)) {
          node.getField(parentPath).remove(path)
        } else {
          let field = _.head(path)
          let index = parseInt(field)
          if (_.isNaN(index)) {
            F.unsetOn(field, node.value)
            F.unsetOn(field, node.fields)
          } else {
            node.value.splice(index, 1)
            node.fields.splice(index)
            node.add(node.value.splice(index))
          }
        }
      },
    })
    return node
  }

  let initField = (field, fieldPath = []) => {
    let node = fieldMethods(field, fieldPath)
    extendObservable(node, {
      label: field.label || _.startCase(field.field),
      get value() {
        return _.get(fieldPath, form.value)
      },
      set value(x) {
        F.setOn(fieldPath, x, form.value)
      },
      get errors() {
        return _.getOr([], _.join('.', fieldPath), form.errors)
      },
      set errors(x) {
        F.setOn(_.join('.', fieldPath), x, form.errors)
      },
    })
    return afterInitField(node, field)
  }

  let baseNode = {
    value: _.mapValues('value', config.fields),
    fields: _.mapValues(_.omit('value'), config.fields),
    errors: {},
  }
  let form = extendObservable(fieldMethods(baseNode), {
    fields: initFields(baseNode.fields, baseNode.value),
    getSnapshot: () => F.flattenObject(toJS(form.value)),
    getNestedSnapshot: () => F.unflattenObject(toJS(form.value)),
    getPatch: () =>
      _.omitBy(_.isNil, unmerge(toJS(baseNode.value), toJS(form.value))),
    submit: Command(() => {
      form.submit.state.error = null
      if (_.isEmpty(form.validate())) return submit(form.getSnapshot(), form)
      throw 'Validation Error'
    }),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
  })
  form.clean()
  return form
}
