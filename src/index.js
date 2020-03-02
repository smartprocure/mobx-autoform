import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable } from 'mobx'
import * as validators from './validators'
import { tokenizePath, pickFields, safeJoinPaths } from './util'
import { treePath, splitAt } from './futil'
import { get, set, toJS } from './mobx'
export { validators }

let clone = _.flow(toJS, _.cloneDeep)
let unmerge = _.flow(F.simpleDiff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))
let throwIfLeaf = x =>
  !_.has('fields', x) &&
  !_.has('itemField', x) &&
  F.throws(`${_.join('.', x.path)}: No fields or itemField`)
let fieldPath = _.flow(F.intersperse('fields'), _.compact)

export default ({
  afterInitField = x => x,
  validate = validators.functions,
  ...config
}) => {
  let saved = {}

  let state = observable({
    // config.field values are more of default values than anything else
    // Only supporting them to avoid massive breaking changes
    value: _.merge(_.mapValues('value', config.fields), config.value),
    errors: {},
  })

  let initField = config => {
    let dotPath = _.join('.', config.path)
    let valuePath = ['value', ...config.path]
    let node = observable({
      ..._.omit('path', config),
      field: _.last(config.path),
      label: config.label || _.startCase(_.last(config.path)),
      get value() {
        return get(valuePath, state)
      },
      set value(x) {
        set(valuePath, x, state)
      },
      get errors() {
        return _.isEmpty(dotPath)
          ? state.errors
          : get([dotPath], state.errors) || []
      },
      get isValid() {
        return _.isEmpty(node.errors)
      },
      get isDirty() {
        return changed(_.get(valuePath, saved), toJS(node.value))
      },
      getField(path) {
        path = fieldPath(tokenizePath(path))
        return _.isEmpty(path) ? node : _.get(safeJoinPaths(path), node.fields)
      },
      clean() {
        F.setOn(valuePath, clone(node.value), saved)
      },
      reset(value) {
        // Reset errors
        if (_.isEmpty(node.path)) clearFormErrors()
        else F.unsetOn([dotPath], state.errors)
        // Reset value
        if (!_.isUndefined(value)) F.setOn(valuePath, clone(value), saved)
        node.value = clone(_.get(valuePath, saved))
        // Re-init array fields and set default values
        F.walk(x => x.fields)(x => {
          let valuePath = ['value', ...x.path]
          if (x.itemField) x.fields = initFields(makeItemFields(x), x.path)
          if (_.isUndefined(x.value)) x.value = clone(x.defaultValue)
          if (_.isUndefined(_.get(valuePath, saved)))
            F.setOn(valuePath, clone(x.defaultValue), saved)
        })(node)
      },
      validate(paths) {
        let picked = pickFields(form, _.isEmpty(paths) ? [dotPath] : paths)
        state.errors = {
          ..._.omit(_.keys(picked), state.errors),
          ...validate(form, picked),
        }
        return _.pick(_.keys(picked), state.errors)
      },
      add(x) {
        throwIfLeaf(node)
        if (node.itemField) {
          if (_.isUndefined(node.value)) node.value = []
          node.value.push(x)
          node.fields.push(
            initTree(clone(node.itemField), [...node.path, node.fields.length])
          )
        } else if (node.fields) {
          if (_.isUndefined(node.value)) node.value = {}
          extendObservable(node.value, _.mapValues('value', x))
          extendObservable(node.fields, initFields(x, node.path))
        }
      },
      remove(x) {
        if (_.isUndefined(node.value)) return
        let [parentPath, path] = splitAt(-1, tokenizePath(x))
        if (!_.isEmpty(parentPath)) {
          let field = node.getField(parentPath)
          field && field.remove(path)
        } else {
          throwIfLeaf(node)
          let [key] = path
          if (node.itemField) {
            node.value.splice(key, 1)
            node.fields.splice(key)
            _.each(node.add, node.value.splice(key))
          } else if (node.fields) {
            F.unsetOn(key, node.value)
            F.unsetOn(key, node.fields)
          }
          // Clear errors for this field and nested fields as well
          let dotPath = _.join('.', node.path)
          state.errors = F.pickByIndexed(
            (x, k) => !_.startsWith(dotPath, k),
            state.errors
          )
        }
      },
    })
    node.path = config.path
    return afterInitField(node, config)
  }

  let makeItemFields = x =>
    _.times(
      () => clone(x.itemField),
      _.size(_.get(['value', ...x.path], state) || x.defaultValue)
    )

  let initTree = (config, rootPath) =>
    F.reduceTree(x => x.fields)((tree, node, ...args) => {
      let path = treePath(node, ...args)
      // Stamp path on node
      node.path = [...rootPath, ...path]
      // Populate array fields so we can recurse on them
      if (node.itemField) node.fields = makeItemFields(node)
      let field = initField(node)
      // Set default value. We also want to set them even if they're undefined
      // to maintain backwards compatibility on snapshots
      if (_.isUndefined(field.value)) field.value = clone(field.defaultValue)
      // If path is empty, we've just initialized the root node, so return that
      return _.isEmpty(path)
        ? field
        : F.setOn(['fields', ...fieldPath(path)], field, tree)
    })({})(config)

  let initFields = (configs, rootPath) =>
    (_.isArray(configs) ? F.mapIndexed : F.mapValuesIndexed)(
      (x, k) => initTree(x, [...rootPath, k]),
      configs
    )

  let clearFormErrors = () => {
    state.errors = {}
    form.submit.state.error = null
  }

  let form = extendObservable(initTree(config, []), {
    getSnapshot: () => F.flattenObject(toJS(state.value)),
    getNestedSnapshot: () => F.unflattenObject(toJS(state.value)),
    getPatch: () => unmerge(saved.value, toJS(state.value)),
    submit: Command(() => {
      clearFormErrors()
      !_.isEmpty(form.validate()) && F.throws('Validation Error')
      return config.submit(form.getSnapshot(), form)
    }),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
  })
  F.unsetOn('field', form)
  F.unsetOn('label', form)
  form.clean()
  return form
}
