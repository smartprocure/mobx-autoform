import _ from 'lodash/fp.js'
import F from 'futil'
import * as m from 'mobx'

// Observable without proxy for any version of mobx
export let observable = x => {
  try {
    return m.observable(x, {}, { proxy: false })
  } catch (e) {
    return m.observable(x)
  }
}

// https://github.com/mobxjs/mobx/issues/2912#issuecomment-825890901
export let toJS = x =>
  _.cloneDeepWith(value => {
    if (m.isObservable(value)) return m.toJS(value)
  }, x)

// Nested path getter/setter. Only supports array paths for now

export let get = (path, obj) =>
  _.reduce((v, k) => (m.isObservable(v) ? m.get(v, k) : _.get(k, v)), obj, path)

export let set = (path, v, obj) => {
  let n = F.reduceIndexed(
    (v, k, i) => {
      if (!m.isObservable(_.get(k, v))) {
        let isNextKeyNumber = !_.isNaN(parseInt(_.get(i + 1, path)))
        m.set(v, k, isNextKeyNumber ? [] : {})
      }
      return v[k]
    },
    obj,
    _.dropRight(1, path)
  )
  m.set(n, _.last(path), v)
  return obj
}
