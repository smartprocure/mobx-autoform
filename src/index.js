import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable } from 'mobx'
import * as validators from './validators'
import {
  tokenizePath,
  joinPaths,
  pickFields,
  buildPath,
  toJSDeep,
} from './util'
export { validators }

let simpleDiff = (original, deltas) => {
  let o = F.flattenObject(original)
  return _.flow(
    F.flattenObject,
    F.mapValuesIndexed((to, field) => ({ from: o[field], to })),
    _.omitBy(x => _.isEqual(x.from, x.to))
  )(deltas)
}
let clone = _.flow(toJSDeep, _.cloneDeep)
let unmerge = _.flow(simpleDiff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))
let buildFieldPath = _.flow(tokenizePath, F.intersperse('fields'), _.compact)
let maybeObservable = x => {
  _.attempt(() => (x = observable(x)))
  return x
}

export default ({
  afterInitField = x => x,
  validate = validators.functions,
  ...config
}) => {
  let savedState = {}

  let state = observable({
    value: config.value || _.mapValues('value', config.fields),
    errors: {},
  })

  let initField = config => {
    let dotPath = _.join('.', config.path)
    let errorsPath = _.join('.', ['errors', ...config.path])
    let getSavedValue = (path = config.path) =>
      _.get(['value', ...path], savedState)
    let setSavedValue = (x, path = config.path) =>
      F.setOn(['value', ...path], x, savedState)
    let node = observable({
      ..._.omit('path', config),
      field: _.last(config.path),
      label: config.label || _.startCase(_.last(config.path)),
      get value() {
        return _.get(['value', ...node.path], state)
      },
      set value(x) {
        F.setOn(['value', ...node.path], x, state)
      },
      get errors() {
        return _.getOr(!_.has('fields', config) ? [] : {}, errorsPath, state)
      },
      set errors(x) {
        F.setOn(errorsPath, x, state)
      },
      get isValid() {
        return _.isEmpty(node.errors)
      },
      get isDirty() {
        return changed(getSavedValue(), toJSDeep(node.value))
      },
      getField(path) {
        let fieldPath = buildFieldPath(path)
        return _.isEmpty(fieldPath)
          ? node
          : _.get(joinPaths(fieldPath), node.fields)
      },
      clean() {
        setSavedValue(clone(node.value))
      },
      reset(value) {
        // Reset errors
        if (_.isEmpty(node.path)) form.submit.state.error = null // Lil hack
        F.unsetOn('errors', node)
        // Reset value
        if (!_.isUndefined(value)) setSavedValue(clone(value))
        node.value = maybeObservable(getSavedValue())
        F.walk(x => x.fields)(x => {
          // Re-init array fields
          if (x.itemField)
            x.fields = observable(initFields(makeItemFields(x), x.path))
          // Set default values
          if (_.isUndefined(x.value)) x.value = clone(x.defaultValue)
          if (_.isUndefined(getSavedValue(x.path)))
            setSavedValue(clone(x.defaultValue), x.path)
        })(node)
      },
      validate(paths) {
        let picked = pickFields(form, paths || [dotPath])
        state.errors = {
          ..._.omit(_.keys(picked), state.errors),
          ...validate(form, picked),
        }
        return state.errors
      },
      add(x) {
        if (node.itemField) {
          F.defaultsOn({ value: observable([]) })(node)
          node.value.push(x)
          node.fields.push(
            initTree(clone(node.itemField), [...node.path, node.fields.length])
          )
        } else if (node.fields) {
          if (_.isEmpty(x)) return
          F.defaultsOn({ value: observable({}) })(node)
          extendObservable(node.value, _.mapValues('value', x))
          extendObservable(node.fields, initFields(x, node.path))
        } else {
          throw new Error(`${dotPath}: No fields or itemField`)
        }
      },
      remove(x) {
        let parentPath = tokenizePath(x)
        let path = parentPath.splice(parentPath.length - 1)
        if (!_.isEmpty(parentPath)) {
          let field = node.getField(parentPath)
          field && field.remove(path)
          return
        }
        if (_.isUndefined(node.value)) return
        let field = _.head(path)
        if (node.itemField) {
          let index = parseInt(field)
          node.value.splice(index, 1)
          node.fields.splice(index)
          _.each(node.add, node.value.splice(index))
        } else if (node.fields) {
          F.unsetOn(field, node.value)
          F.unsetOn(field, node.fields)
        } else {
          throw new Error(`${dotPath}: No fields or itemField`)
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
      let path = buildPath(node, ...args)
      node.path = [...rootPath, ...path]
      if (node.itemField) node.fields = makeItemFields(node)
      let field = initField(node)
      // Even if defaultValue was not passed, we need add the
      // property so so reactions work. Ex:
      //  > let a = {}
      //  > reaction(() => a.b, _.noop)
      //  > a.b = ''
      // In the above example, the reaction won't be triggered
      if (_.isUndefined(field.value)) field.value = clone(field.defaultValue)
      return _.isEmpty(path)
        ? field
        : F.setOn(['fields', ...buildFieldPath(path)], field, tree)
    })({})(config)

  let initFields = (configs, rootPath) =>
    (_.isArray(configs) ? F.mapIndexed : F.mapValuesIndexed)(
      (x, k) => initTree(x, [...rootPath, k]),
      configs
    )

  let form = extendObservable(initTree({ fields: config.fields }, []), {
    getSnapshot: () => F.flattenObject(toJSDeep(state.value)),
    getNestedSnapshot: () => F.unflattenObject(toJSDeep(state.value)),
    getPatch: () => unmerge(savedState.value, toJSDeep(state.value)),
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
  })
  F.unsetOn('field', form)
  F.unsetOn('label', form)
  form.clean()
  return form
}
