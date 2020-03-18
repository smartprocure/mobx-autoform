import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable, reaction } from 'mobx'
import * as validators from './validators'
import { tokenizePath, safeJoinPaths, gatherFormValues } from './util'
import { treePath, omitByPrefixes, pickByPrefixes } from './futil'
import { get, set, toJS } from './mobx'
export { validators }

let clone = _.flow(toJS, _.cloneDeep)
let unmerge = _.flow(F.diff, _.mapValues('to'))
let changed = (x, y) => !_.isEqual(x, y) && !(F.isBlank(x) && F.isBlank(y))
let Command = F.aspects.command(x => y => extendObservable(y, x))
let fieldPath = _.flow(F.intersperse('fields'), _.compact)
let flattenField = F.flattenTree(x => x.fields)((...x) =>
  _.join('.', treePath(...x))
)

export default ({
  value,
  afterInitField = x => x,
  validate = validators.functions,
  ...config
}) => {
  let saved = {}
  let state = observable({ value, errors: {}, disposers: {} })

  let initField = (config, rootPath = []) => {
    let dotPath = _.join('.', rootPath)
    let valuePath = ['value', ...rootPath]

    let node = observable({
      ...config,
      field: _.last(rootPath),
      label: config.label || _.startCase(_.last(rootPath)),
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
        node.value = clone(_.get(valuePath, saved))
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
        F.setOn(valuePath, clone(node.value), saved)
      },
      getField(path) {
        return _.get(safeJoinPaths(fieldPath(tokenizePath(path))), node.fields)
      },
      dispose() {
        _.over(_.values(pickByPrefixes([dotPath], state.disposers)))()
        state.disposers = omitByPrefixes([dotPath], state.disposers)
      },
      remove() {
        let parent = form.getField(_.dropRight(1, rootPath)) || form
        // If array field, remove the value and the reaction will take care of the rest
        if (parent.itemField) parent.value.splice(node.field, 1)
        // Remove object field
        else {
          node.dispose()
          F.unsetOn(node.field, parent.value)
          F.unsetOn(node.field, parent.fields)
        }
        // Clean errors for this field and all subfields
        state.errors = omitByPrefixes(dotPath, state.errors)
      },
    })
    node.path = rootPath

    // config.value acts as a default value
    if (_.isUndefined(node.value) && !_.isUndefined(config.value))
      node.value = clone(config.value)

    // Only allow adding subfields for nested object fields
    if (node.fields)
      node.add = configs =>
        extendObservable(
          node.fields,
          F.mapValuesIndexed((x, k) => initTree(x, [...rootPath, k]), configs)
        )

    // Recreate all array fields on array size changes
    if (node.itemField) {
      node.fields = observable([])
      state.disposers[dotPath] = reaction(
        () => _.size(node.value),
        size => {
          _.each(x => x.dispose(), node.fields)
          node.fields.replace(
            _.times(
              index => initTree(node.itemField, [...rootPath, index]),
              size
            )
          )
        }
      )
    }

    return afterInitField(node, config)
  }

  let initTree = (config, rootPath = []) =>
    F.reduceTree(x => x.fields)((tree, node, ...args) => {
      let path = treePath(node, ...args)
      let field = initField(node, [...rootPath, ...path])
      // Set fields on node to keep recursing
      if (node.itemField)
        node.fields = _.times(() => clone(node.itemField), _.size(field.value))
      return _.isEmpty(path)
        ? field
        : set(['fields', ...fieldPath(path)], field, tree)
    })({})(clone(_.defaults({ fields: {} }, config)))

  let form = extendObservable(initTree(config), {
    // Ideally we'd just do toJS(form.value) but we have to maintain backwards
    // compatibility and include fields with undefined values as well
    getSnapshot: () => F.flattenObject(toJS(gatherFormValues(form))),
    getNestedSnapshot: () => F.unflattenObject(form.getSnapshot()),
    getPatch: () => unmerge(saved.value, toJS(state.value)),
    submit: Command(() => {
      form.submit.state.error = null
      if (_.isEmpty(form.validate()))
        return config.submit(form.getSnapshot(), form)
      else throw 'Validation Error'
    }),
    get submitError() {
      return F.getOrReturn('message', form.submit.state.error)
    },
  })

  form.reset = F.aspectSync({
    before: () => (form.submit.state.error = null),
  })(form.reset)
  F.unsetOn('field', form)
  F.unsetOn('label', form)
  F.unsetOn('remove', form)
  form.clean()

  return form
}
