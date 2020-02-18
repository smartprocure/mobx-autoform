import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable } from 'mobx'
import * as validators from './validators'
import {
  tokenizePath,
  joinPaths,
  pickFields,
  filterTree,
  buildPath,
  toJSRecurse,
} from './util'
export { validators }

let unmerge = _.flow(F.simpleDiff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))
let buildFieldPath = _.flow(tokenizePath, F.intersperse('fields'), _.compact)
let cleanTree = x => filterTree(_.negate(_.isUndefined), toJSRecurse(x))
let defaultsOnPath = (path, value, obj) =>
  F.setOn(path, _.merge(value, _.get(path, obj)), obj)
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
    let isLeaf = !_.has('itemField', config) && !_.has('fields', config)
    // Just a helper to help with readability
    let savedNode = {
      get value() {
        return _.get(['value', ...config.path], savedState)
      },
      set value(x) {
        F.setOn(['value', ...config.path], x, savedState)
      },
    }
    let node = observable({
      ..._.omit('path', config),
      field: _.last(config.path),
      label: config.label || _.startCase(_.last(config.path)),
      get value() {
        return _.get(['value', ...config.path], state)
      },
      set value(x) {
        F.setOn(['value', ...config.path], x, state)
      },
      get errors() {
        return _.getOr(isLeaf ? [] : {}, errorsPath, state)
      },
      set errors(x) {
        F.setOn(errorsPath, x, state)
      },
      get isValid() {
        return _.isEmpty(node.errors)
      },
      get isDirty() {
        return changed(savedNode.value, toJSRecurse(node.value))
      },
      getField(path) {
        let fieldPath = buildFieldPath(path)
        return _.isEmpty(fieldPath)
          ? node
          : _.get(joinPaths(fieldPath), node.fields)
      },
      clean() {
        savedNode.value = toJSRecurse(node.value)
      },
      reset(value) {
        // Reset errors
        if (_.isEmpty(config.path)) form.submit.state.error = null // Lil hack
        F.unsetOn('errors', node)
        // Reset value
        if (!_.isUndefined(value)) savedNode.value = toJSRecurse(value)
        node.value = maybeObservable(savedNode.value)
        // Re-sync array fields and add missing values for reactions to work
        F.walk(x => x.fields)(x => {
          if (x.itemField)
            x.fields = observable(initFields(makeItemFields(x), x.path))
          if (_.isPlainObject(x.fields)) {
            let def = _.mapValues(_.constant(undefined), x.fields)
            defaultsOnPath(['value', ...x.path], def, node)
            defaultsOnPath(['value', ...x.path], def, savedNode)
          }
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
          // if (_.isUndefined(x)) return
          F.defaultsOn({ value: observable([]) })(node)
          node.value.push(x)
          node.fields.push(
            initTree(_.cloneDeep(node.itemField), [
              ...config.path,
              node.fields.length,
            ])
          )
        } else if (node.fields) {
          if (_.isEmpty(x)) return
          F.defaultsOn({ value: observable({}) })(node)
          extendObservable(node.value, _.mapValues('value', x))
          extendObservable(node.fields, initFields(x, config.path))
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

  let makeItemFields = node =>
    _.times(
      () => _.cloneDeep(node.itemField),
      _.size(_.get(['value', ...node.path], state))
    )

  let initTree = (config, rootPath) =>
    F.reduceTree(config => config.fields)((tree, node, ...args) => {
      let path = buildPath(node, ...args)
      node.path = [...rootPath, ...path]
      // Set array fields to allow recursing into them
      if (node.itemField) node.fields = makeItemFields(node)
      // Set default values so reactions work. Ex:
      //  > let a = {}
      //  > reaction(() => a.b, _.noop)
      //  > a.b = ''
      // In the above example, the reaction won't be triggered
      if (_.isPlainObject(node.fields)) {
        let def = _.mapValues(_.constant(undefined), node.fields)
        defaultsOnPath(['value', ...node.path], def, state)
      }
      let field = initField(node)
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
    getSnapshot: () => F.flattenObject(cleanTree(state.value)),
    getNestedSnapshot: () => F.unflattenObject(cleanTree(state.value)),
    getPatch: () => unmerge(savedState.value, toJSRecurse(state.value)),
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
