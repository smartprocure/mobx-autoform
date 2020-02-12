import _ from 'lodash/fp'
import Form from './index'
import { flattenFields, fieldPath } from './util'

let fields = {
  location: {
    fields: {
      'country.state': {},
      addresses: {
        validator: () => 'Invalid address',
        items: {
          street: {},
          tenants: {
            items: {
              name: { validator: () => 'Invalid name' },
              age: {},
            },
          },
        },
      },
    },
    value: {
      addresses: [{ street: 'Meridian', tenants: [{ name: 'John' }] }],
    },
  },
}

let form = Form({ fields })

it('flattenFields', () => {
  expect(_.keys(flattenFields(form))).toEqual([
    'location',
    'location.country.state',
    'location.addresses',
    'location.addresses.0.street',
    'location.addresses.0.tenants',
    'location.addresses.0.tenants.0.name',
    'location.addresses.0.tenants.0.age',
  ])
})

it('fieldPath', () => {
  expect(fieldPath('')).toEqual([])
  let arrayPath = ['location', 'country.state', '0', 'street']
  let stringPath = 'location."country.state".0.street'
  let result = [
    'fields',
    'location',
    'fields',
    'country.state',
    'fields',
    '0',
    'street',
  ]
  expect(fieldPath(arrayPath)).toEqual(result)
  expect(fieldPath(stringPath)).toEqual(result)
})
