import _ from 'lodash/fp'
import F from 'futil'
import * as m from 'mobx'

export let toJS = x => m.toJS(x, { recurseEverything: true })

// Only supports array paths for now

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
