import F from 'futil'
import _ from 'lodash/fp'
import { reaction, isObservable, observable } from 'mobx'
import Form from './index'
import { buildPath, toJSRecurse } from './util'

require('util').inspect.defaultOptions.depth = null

let walkNodes = fn =>
  F.walk(x => x.fields)((node, ...args) => {
    fn(node, buildPath(node, ...args))
  })

let dispose = _.noop
let form = null

beforeEach(() => {
  dispose()
  form = Form({
    fields: {
      location: {
        fields: {
          'country.state': {
            label: 'Dotted field name',
            fields: {
              zip: {
                validator: () => 'Invalid zip',
              },
              name: {},
            },
          },
          addresses: {
            label: 'Array field',
            itemField: {
              label: 'Item field is a record',
              fields: {
                street: {},
                tenants: {
                  label: 'Array field',
                  itemField: {
                    label: 'Item field is a primitive',
                    validator: () => 'Invalid tenant',
                  },
                },
              },
            },
          },
        },
      },
    },
    value: {
      location: {
        'country.state': { zip: '07016' },
        addresses: [{ street: 'Meridian', tenants: ['John'] }, {}],
      },
    },
  })
})

describe('Fields were correctly initialized', () => {
  it.each([
    'location.["country.state"]', // Nested field
    'location.addresses.0', // Array item field
    'location.addresses.0.street', // Record array item field
    'location.addresses.0.tenants.0', // Scalar array item field
  ])('%s', path => {
    let field = form.getField(path)
    expect(field).not.toBeUndefined()
    expect(field.value).toBe(_.get(path, form.value))
  })
})

let initialValue = {
  location: {
    'country.state': { zip: '07016', name: undefined },
    addresses: [
      { street: 'Meridian', tenants: ['John'] },
      { street: undefined, tenants: undefined },
    ],
  },
}

it('Value was correctly initialized', () => {
  expect(toJSRecurse(form.value)).toStrictEqual(initialValue)
})

describe('add()', () => {
  it('Does not allow adding on scalar fields', () => {
    expect(() =>
      form.getField('location.["country.state"].zip').add({})
    ).toThrow()
  })

  describe('Array field', () => {
    let address = { street: undefined, tenants: undefined }
    it.each([
      // Array of records
      ['location.addresses', undefined, address],
      ['location.addresses', null, address],
      ['location.addresses', {}, address],
      ['location.addresses', { extra: 'val' }, { ...address, extra: 'val' }],
      ['location.addresses', { street: 'val' }, { ...address, street: 'val' }],
      // Array of scalars
      ['location.addresses.1.tenants', undefined, undefined],
      ['location.addresses.1.tenants', null, null],
      ['location.addresses.1.tenants', 'Jack', 'Jack'],
      ['location.addresses.1.tenants', { extra: 'val' }, { extra: 'val' }],
    ])('%s: add %o', (path, value, expected) => {
      let field = form.getField(path)
      field.add(value)
      expect(_.last(field.value)).toStrictEqual(expected)
      expect(_.last(field.fields).value).toStrictEqual(expected)
      expect(_.last(_.get(path, form.value))).toStrictEqual(expected)
      if (field.itemField.fields)
        expect(isObservable(_.last(field.value))).toBe(true)
    })
  })

  describe('Object field', () => {
    let fieldsValues = field => toJSRecurse(_.mapValues('value', field.fields))
    it.each([
      ['location.["country.state"]', undefined, undefined],
      ['location.["country.state"]', null, undefined],
      ['location.["country.state"]', { a: {} }, { a: undefined }],
      ['location.["country.state"]', { a: { value: 'b' } }, { a: 'b' }],
      // Top-level node (form)
      [undefined, { top: { value: 'field' } }, { top: 'field' }],
    ])('%s: add %o', (path, value, expected) => {
      let field = form.getField(path)
      let before = fieldsValues(field)
      field.add(value)
      expect(fieldsValues(field)).toStrictEqual({ ...before, ...expected })
      expect(toJSRecurse(field.value)).toStrictEqual({ ...before, ...expected })
    })
  })
})

describe('remove()', () => {
  describe('Array field', () => {
    it.each([
      // Non-empty array
      ['location.addresses', 2, 0], // out of bounds
      ['location.addresses', 0, 1],
      // Empty array
      ['location.addresses.1.tenants', 2, 0], // out of bounds
      ['location.addresses.1.tenants', 0, 0],
      [undefined, 0, 0], // Top-level node (form)
    ])('%s: remove [%i]', (path, index, removedSize) => {
      let field = form.getField(path)
      let lengthBefore = _.size(field.value)
      field.remove(index)
      expect(_.size(field.value)).toBe(lengthBefore - removedSize)
      expect(_.size(field.fields)).toBe(_.size(field.value))
      F.eachIndexed(
        (x, i) => expect(x.value).toBe(field.value[i]),
        field.fields
      )
    })
  })

  describe('Object field', () => {
    it.each([
      ['location', '["country.state"].zip'], // Non-empty object
      ['location', 'non.existing'], // Empty object
      [undefined, 'location.["country.state"]'], // Top-level node (form)
    ])('%s: remove %s', (path, pathToRemove) => {
      let field = form.getField(path)
      field.remove(pathToRemove)
      expect(field.getField(pathToRemove)).toBeUndefined()
    })
  })
})

describe('reset()', () => {
  describe('value', () => {
    it.each([
      [
        undefined, // Path (form)
        undefined, // Reset to initial value
        {
          location: {
            'country.state': { zip: '07016', name: undefined },
            addresses: [
              { street: 'Meridian', tenants: ['John'] },
              { street: undefined, tenants: undefined },
            ],
          },
        },
      ],
      [
        undefined, // Path (form)
        { reset: { this: true } }, // Reset value
        {
          location: {
            'country.state': { zip: undefined, name: undefined },
            addresses: undefined,
          },
          reset: { this: true },
        },
      ],
      [
        'location.addresses', // Path
        undefined, // Reset to initial value
        [
          { street: 'Meridian', tenants: ['John'] },
          { street: undefined, tenants: undefined },
        ],
      ],
      // Reset form to this value
      ['location.addresses', [], []],
    ])('reset path "%s" to "%o"', (path, value, expected) => {
      let field = form.getField(path)

      // Mutate all nodes
      walkNodes(x => {
        if (x.itemField) x.add('New')
        else if (!_.isPlainObject(x.fields)) x.value = 'New'
      })(field)

      // Reset to value
      field.reset(value)

      // Check values were reset
      expect(toJSRecurse(field.value)).toStrictEqual(expected)

      // Check array fields were reset
      walkNodes((node, p) => {
        if (node.itemField) {
          let value = _.has(p, expected) ? _.get(p, expected) : expected
          expect(_.size(node.fields)).toBe(_.size(value))
        }
      })(field)
    })
  })

  describe('errors', () => {})
})

describe('validate()', () => {
  it('field', () => {
    let name = form.getField('location.addresses.0.tenants.0')
    expect(name.validate()).toStrictEqual({
      'location.addresses.0.tenants.0': 'Invalid tenant',
    })
  })
  it('form', () => {
    expect(form.isValid).toBe(true)
    expect(form.validate()).toStrictEqual({
      'location.country.state.zip': 'Invalid zip',
      'location.addresses.0.tenants.0': 'Invalid tenant',
    })
    expect(form.isValid).toBe(false)
  })
})

// it('errors | isValid', () => {
//   let name = form.getField('location.addresses.0.tenants.0')
//   expect(name.isValid).toBe(true)
//   let isValid = jest.fn()
//   let errors = jest.fn()
//   dispose = _.over(
//     reaction(
//       () => name.isValid,
//       x => isValid(x)
//     ),
//     reaction(
//       () => name.errors,
//       x => errors(x)
//     )
//   )
//   name.validate()
//   expect(errors).toHaveBeenCalledWith('Invalid tenant')
//   expect(isValid).toHaveBeenCalledWith(false)
//   form.reset()
//   expect(errors).toHaveBeenCalledWith([])
//   expect(isValid).toHaveBeenCalledWith(true)
// })

describe('isDirty', () => {
  it('field', () => {
    let name = form.getField('location.addresses.0.tenants.0')
    expect(name.isDirty).toBe(false)
    let handler = jest.fn()
    dispose = reaction(
      () => name.isDirty,
      x => handler(x)
    )
    name.value = 'New'
    expect(handler).toHaveBeenCalledWith(true)
  })
  it('form', () => {
    expect(form.isDirty).toBe(false)
    let handler = jest.fn()
    dispose = reaction(
      () => form.isDirty,
      x => handler(x)
    )
    form.getField('location.addresses.0.street').value = 'New'
    expect(handler).toHaveBeenCalledWith(true)
    form.reset()
    expect(handler).toHaveBeenCalledWith(false)
  })
})

it('getSnapshot()', () => {
  expect(form.getSnapshot()).toStrictEqual({
    'location.country.state.zip': '07016',
    'location.addresses.0.street': 'Meridian',
    'location.addresses.0.tenants.0': 'John',
  })
})

it('getNestedSnapshot()', () => {
  expect(form.getNestedSnapshot()).toStrictEqual({
    location: {
      'country.state': { zip: '07016' },
      addresses: [{ street: 'Meridian', tenants: ['John'] }],
    },
  })
  form.getField('location.addresses').remove(0)
  expect(form.getNestedSnapshot()).toStrictEqual({
    location: { 'country.state': { zip: '07016' } },
  })
})

describe('getPatch()', () => {
  it('Array fields', () => {
    let addresses = form.getField('location.addresses')
    addresses.add()
    // Ignores undefined values
    expect(form.getPatch()).toStrictEqual({})
    // Picks up new values
    addresses.getField('2.street').value = 'Washington'
    expect(form.getPatch()).toStrictEqual({
      'location.addresses.2.street': 'Washington',
    })
    // Works after clean()
    form.clean()
    expect(form.getPatch()).toStrictEqual({})
    // Works after reset()
    addresses.getField('0.street').value = 'Jefferson'
    form.reset()
    expect(form.getPatch()).toStrictEqual({})
  })

  it('Object fields', () => {
    let state = form.getField('location.["country.state"]')
    state.add({ capital: {} })
    // Ignores undefined values
    expect(form.getPatch()).toStrictEqual({})
    // Picks up new values
    state.getField('capital').value = 'Tallahase'
    expect(form.getPatch()).toStrictEqual({
      'location.country.state.capital': 'Tallahase',
    })
    // Works after clean()
    form.clean()
    expect(form.getPatch()).toStrictEqual({})
    // Works after reset()
    state.getField('capital').value = 'Tallahase'
    form.reset()
    expect(form.getPatch()).toStrictEqual({})
  })
})
