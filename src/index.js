import F from 'futil'
import _ from 'lodash/fp.js'
import { extendObservable, reaction } from 'mobx'
import * as validators from './validators.js'
import {
  tokenizePath,
  safeJoinPaths,
  gatherFormValues,
  ValidationError,
} from './util.js'
import { treePath, omitByPrefixes, pickByPrefixes } from './futil.js'
import { get, set, toJS, observable } from './mobx.js'

export { validators, ValidationError }

let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))

export let jsonSchemaKeys = {
  label: 'title',
  fields: 'properties',
  itemField: 'items',
  defaultValue: 'default',
}

export let legacyKeys = {
  label: 'label',
  fields: 'fields',
  itemField: 'itemField',
  defaultValue: 'value',
}

let defaultGetPatch = form =>
  _.mapValues('to', F.diff(form.saved.value, toJS(form.value)))

// Ideally we'd just do toJS(form.value) but we have to maintain backwards
// compatibility and include fields with undefined values as well
let defaultGetSnapshot = form => F.flattenObject(toJS(gatherFormValues(form)))

let defaultGetNestedSnapshot = form => F.unflattenObject(form.getSnapshot())

const handleSubmitErr = (state, err) => {
  if (err instanceof ValidationError) {
    state.errors = err.cause
  }
  throw err
}

export default ({
  submit: configSubmit,
  value = {},
  afterInitField = x => x,
  validate = validators.functions,
  identifier = 'unknown',
  keys = legacyKeys,
  getPatch = defaultGetPatch,
  getSnapshot = defaultGetSnapshot,
  getNestedSnapshot = defaultGetNestedSnapshot,
  ...autoFormConfig
}) => {
  let fieldPath = _.flow(F.intersperse(keys.fields), _.compact)
  let flattenField = F.flattenTree(x => x[keys.fields])((...x) =>
    _.join('.', treePath(...x))
  )

  let saved = {}
  let state = observable({ value, errors: {}, disposers: {} })

  let initField = (config, rootPath = []) => {
    let dotPath = _.join('.', rootPath)
    let valuePath = ['value', ...rootPath]
    let node = observable({
      ...config,
      field: _.last(rootPath),
      [keys.label]: config[keys.label] || _.startCase(_.last(rootPath)),
      'data-testid': _.snakeCase([identifier, ...rootPath]),
      get value() {
        return get(valuePath, state)
      },
      set value(x) {
        set(valuePath, x, state)
      },
      get errors() {
        return get(_.compact(['errors', dotPath]), state) || []
      },
      get isValid() {
        return _.isEmpty(node.errors)
      },
      get isDirty() {
        return changed(_.get(valuePath, saved), toJS(node.value))
      },
      reset() {
        node.value = toJS(_.get(valuePath, saved))
        state.errors = omitByPrefixes([dotPath], state.errors)
      },
      validate(paths = [dotPath]) {
        let errors = validate(form, pickByPrefixes(paths, flattenField(form)))
        state.errors = {
          ...omitByPrefixes(paths, state.errors),
          ...errors,
        }
        return errors
      },
      clean() {
        F.setOn(valuePath, toJS(node.value), saved)
      },
      getField(path) {
        return _.get(
          safeJoinPaths(fieldPath(tokenizePath(path))),
          node[keys.fields]
        )
      },
      dispose() {
        _.over(_.values(pickByPrefixes([dotPath], state.disposers)))()
        state.disposers = omitByPrefixes([dotPath], state.disposers)
      },
      remove() {
        let parent = form.getField(_.dropRight(1, rootPath)) || form
        // If array field, remove the value and the reaction will take care of the rest
        if (parent[keys.itemField]) parent.value.splice(node.field, 1)
        // Remove object field
        else {
          node.dispose()
          F.unsetOn(node.field, parent.value)
          F.unsetOn(node.field, parent[keys.fields])
        }
        // Clean errors for this field and all subfields
        state.errors = omitByPrefixes(dotPath, state.errors)
      },
    })
    node.path = rootPath

    // config.value acts as a default value
    if (_.isUndefined(node.value) && !_.isUndefined(config[keys.defaultValue]))
      node.value = toJS(config[keys.defaultValue])

    // Only allow adding subfields for nested object fields
    if (node[keys.fields])
      node.add = configs =>
        extendObservable(
          node[keys.fields],
          F.mapValuesIndexed((x, k) => initTree(x, [...rootPath, k]), configs)
        )

    // Recreate all array fields on array size changes
    if (node[keys.itemField]) {
      node[keys.fields] = observable([])
      state.disposers[dotPath] = reaction(
        () => _.size(node.value),
        size => {
          _.each(x => x.dispose(), node[keys.fields])
          node[keys.fields].replace(
            _.times(
              index => initTree(node[keys.itemField], [...rootPath, index]),
              size
            )
          )
        }
      )
    }

    return afterInitField(node, { ...config, keys })
  }

  let initTree = (config, rootPath = []) =>
    F.reduceTree(x => x[keys.fields])((tree, node, ...args) => {
      let path = treePath(node, ...args)
      let field = initField(node, [...rootPath, ...path])
      // Set fields on node to keep recursing
      if (node[keys.itemField])
        node[keys.fields] = _.times(
          () => toJS(node[keys.itemField]),
          _.size(field.value)
        )
      return _.isEmpty(path)
        ? field
        : set([keys.fields, ...fieldPath(path)], field, tree)
    })({})(toJS(config))

  let form = extendObservable(initTree(autoFormConfig), {
    getPatch: () => getPatch(form),
    getSnapshot: () => getSnapshot(form),
    getNestedSnapshot: () => getNestedSnapshot(form),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
  })
  let submit = Command(() => {
    if (_.isEmpty(form.validate())) {
      form.submit.state.error = null
      try {
        // Handle both sync and sync configSubmit
        return Promise.resolve(configSubmit(form.getSnapshot(), form)).catch(
          err => handleSubmitErr(state, err)
        )
      } catch (err) {
        handleSubmitErr(state, err)
      }
    }
    throw 'Validation Error'
  })
  extendObservable(form, { submit })
  form.submit.state = submit.state

  // This allows new and legacy code to work on the same form
  form.keys = keys
  form.saved = saved
  form.reset = F.aspectSync({
    before: () => (form.submit.state.error = null),
  })(form.reset)
  F.unsetOn('field', form)
  F.unsetOn('remove', form)
  form.clean()

  return form
}
