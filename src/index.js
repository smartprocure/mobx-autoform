import F from 'futil'
import _ from 'lodash/fp'
import { observable, extendObservable, reaction } from 'mobx'
import * as validators from './validators'
import { tokenizePath, safeJoinPaths } from './util'
import {
  treePath,
  omitByPrefixes,
  pickByPrefixes,
  splitAt,
  reduceTreePost,
} from './futil'
import { get, set, toJS } from './mobx'
export { validators }

let clone = _.flow(toJS, _.cloneDeep)
let unmerge = _.flow(F.simpleDiff, _.mapValues('to'))
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
  fields = {},
  ...config
}) => {
  let saved = {}
  let state = observable({ value, errors: {}, disposers: {} })

  let initField = (config, rootPath = []) => {
    let dotPath = _.join('.', rootPath)
    let valuePath = ['value', ...rootPath]

    let field = observable({
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
        return _.isEmpty(field.errors)
      },
      get isDirty() {
        return changed(_.get(valuePath, saved), toJS(field.value))
      },
      getField(path) {
        return _.get(safeJoinPaths(fieldPath(tokenizePath(path))), field.fields)
      },
      clean() {
        F.setOn(valuePath, clone(field.value), saved)
      },
      reset() {
        state.errors = omitByPrefixes([dotPath], state.errors)
        field.value = clone(_.get(valuePath, saved))
      },
      validate(paths = [dotPath]) {
        let errors = validate(form, pickByPrefixes(paths, flattenField(form)))
        state.errors = {
          ...omitByPrefixes(paths, state.errors),
          ...errors,
        }
        return errors
      },
      dispose() {
        _.over(_.values(pickByPrefixes([dotPath], state.disposers)))()
        state.disposers = omitByPrefixes([dotPath], state.disposers)
      },
      remove(path) {
        // If we get a path, find the field that owns the last path component
        // and call remove on that. Ex: ['a', 'b', 'c'] => getField(['a', 'b']).remove('c')
        //
        // If we don't get a path, remove this field. For that we need to call
        // remove on this field's parent.
        let [parentPath, childPath] =
          _.isNumber(path) && !_.isUndefined(path)
            ? splitAt(-1, tokenizePath(path))
            : [[_.nth(-2, path)], [_.nth(-1, path)]]

        if (!_.isEmpty(parentPath))
          return field.getField(parentPath).remove(childPath)

        let [key] = childPath
        // If array field, remove the value and the reaction will take care of the rest
        if (field.itemField) field.value.splice(key, 1)
        // Remove object field
        else {
          field.fields[key].dispose()
          F.unsetOn(key, field.value)
          F.unsetOn(key, field.fields)
        }

        // Clean errors for this field and all subfields
        state.errors = omitByPrefixes(
          _.join('.', [...rootPath, ...key]),
          state.errors
        )
      },
    })

    // config.value acts as a default value
    if (_.isUndefined(field.value) && !_.isUndefined(config.value))
      field.value = clone(config.value)

    // Only allow adding subfields for nested object fields
    if (config.fields)
      field.add = configs =>
        extendObservable(
          field.fields,
          F.mapValuesIndexed((x, k) => initTree(x, [...rootPath, k]), configs)
        )

    // Recreate all array fields on array size changes
    if (config.itemField) {
      state.disposers[dotPath] = reaction(
        () => _.size(field.value),
        size => {
          _.each(x => x.dispose(), field.fields)
          field.fields = _.times(
            index => initTree(clone(config.itemField), [...rootPath, index]),
            size
          )
        }
      )
    }

    return afterInitField(field, config)
  }

  let initTree = (config, rootPath = []) =>
    F.reduceTree(x => x.fields)((tree, node, ...args) => {
      let path = treePath(node, ...args)
      let field = initField(node, [...rootPath, ...path])
      if (node.itemField)
        node.fields = _.times(() => clone(node.itemField), _.size(field.value))
      return _.isEmpty(path)
        ? field
        : F.setOn(['fields', ...fieldPath(path)], field, tree)
    })({})(_.cloneDeep(config))

  let form = extendObservable(initTree({ fields, ...config }), {
    getSnapshot: () => F.flattenObject(form.getNestedSnapshot()),
    // Ideally we'd just do toJS(form.value) but we have to maintain backwards
    // compatibility and include fields with undefined values as well
    getNestedSnapshot: () =>
      reduceTreePost(x => x.fields)((tree, x, ...xs) =>
        // Only walk leaf nodes
        x.fields ? tree : _.set(treePath(x, ...xs), x.value, tree)
      )({})(form),
    getPatch: () => unmerge(saved.value, toJS(state.value)),
    submit: Command(() => {
      form.submit.state.error = null
      !_.isEmpty(form.validate()) && F.throws('Validation Error')
      return config.submit(form.getSnapshot(), form)
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
  form.clean()

  return form
}
