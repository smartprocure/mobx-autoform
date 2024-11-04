import _ from 'lodash/fp.js'
import { reaction, runInAction } from 'mobx'
import Form, { jsonSchemaKeys, ValidationError } from './index.js'
import { toJS } from './mobx.js'

require('util').inspect.defaultOptions.depth = null

let fields = {
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
}

let value = {
  location: {
    'country.state': { zip: '07016' },
    addresses: [{ street: 'Meridian', tenants: ['John'] }],
  },
}

describe('Form initialization', () => {
  let paths = [
    'location.["country.state"]', // Nested field
    'location.addresses.0', // Array item field
    'location.addresses.0.street', // Record array item field
    'location.addresses.0.tenants.0', // Scalar array item field
  ]

  let testPath = (form, path) => {
    expect(toJS(form.value)).toStrictEqual(value)
    let field = form.getField(path)
    expect(field).not.toBeUndefined()
    expect(field.value).toBe(_.get(path, form.value))
  }

  describe('Pass value and fields to Form', () => {
    let form = null
    beforeAll(() => {
      form = Form({ value, fields })
    })
    afterAll(() => form.dispose())
    it.each(paths)('Initialized %s', path => testPath(form, path))
  })

  describe('Pass value to Form. Add fields afterwards', () => {
    let form = null
    beforeAll(() => {
      form = Form({ value, fields: {} })
      form.add(fields)
    })
    afterAll(() => form.dispose())
    it.each(paths)('Initialized %s', path => testPath(form, path))
  })

  describe('Pass fields to Form. Add value afterwards', () => {
    let form = null
    beforeAll(() => {
      form = Form({ fields })
      form.value = value
    })
    afterAll(() => form.dispose())
    it.each(paths)('Initialized %s', path => testPath(form, path))
  })

  describe('Should initialize JSON schema flavored form', () => {
    let form = null
    beforeAll(() => {
      form = Form({
        keys: jsonSchemaKeys,
        properties: {
          location: {
            properties: {
              'country.state': {
                title: 'Dotted field name',
                default: value.location['country.state'],
                properties: {
                  zip: {},
                  name: {},
                },
              },
              addresses: {
                title: 'Array field',
                default: value.location.addresses,
                items: {
                  title: 'Item field is a record',
                  properties: {
                    street: {},
                    tenants: {
                      title: 'Array field',
                      items: {
                        title: 'Item field is a primitive',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    })
    afterAll(() => form.dispose())
    it.each(paths)('Initialized %s', path => testPath(form, path))
  })
})

it('Array fields', () => {
  let form = Form({ fields })
  let addresses = form.getField('location.addresses')

  // Test value and fields are tracked
  let valueFn = jest.fn()
  reaction(
    () => _.map(_.identity, addresses.value),
    x => valueFn(x)
  )
  let fieldsFn = jest.fn()
  reaction(
    () => _.map(_.identity, addresses.fields),
    x => fieldsFn(x)
  )
  addresses.value = [{}]
  expect(valueFn).toHaveBeenCalledWith([{}])
  expect(fieldsFn).toHaveBeenCalledTimes(1)

  // Test value and fields are set
  expect(addresses.value.length).toBe(1)
  expect(addresses.fields.length).toBe(1)
})

describe('Methods and computeds', () => {
  let dispose = _.noop
  let form = null

  beforeEach(() => {
    dispose()
    form = Form({ fields, value })
  })
  afterEach(() => form.dispose())

  describe('reset()', () => {
    it.each([
      [
        undefined,
        {
          location: {
            'country.state': { zip: '07016' },
            addresses: [{ street: 'Meridian', tenants: ['John'] }],
          },
        },
      ],
      ['location.addresses', [{ street: 'Meridian', tenants: ['John'] }]],
    ])('reset path "%s"', (path, expected) => {
      let field = _.isUndefined(path) ? form : form.getField(path)
      field.value = ['whatever']
      field.reset()
      expect(toJS(field.value)).toStrictEqual(expected)
    })
  })

  it('remove()', () => {
    form.getField('location.addresses.0.tenants.0').remove()
    let tenants = form.getField('location.addresses.0.tenants')
    expect(tenants.fields).toEqual([])
    expect(tenants.value).toEqual([])

    tenants.remove()
    expect(form.getField('location.addresses.0.tenants')).toBeUndefined()
    expect(form.getField('location.addresses.0').value).toEqual({
      street: 'Meridian',
    })
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

  it('errors | isValid', () => {
    let name = form.getField('location.addresses.0.tenants.0')
    expect(name.isValid).toBe(true)
    let isValid = jest.fn()
    let errors = jest.fn()
    dispose = _.over(
      reaction(
        () => name.isValid,
        x => isValid(x)
      ),
      reaction(
        () => name.errors,
        x => errors(x)
      )
    )
    name.validate()
    expect(errors).toHaveBeenCalledWith('Invalid tenant')
    expect(isValid).toHaveBeenCalledWith(false)
    form.reset()
    expect(errors).toHaveBeenCalledWith([])
    expect(isValid).toHaveBeenCalledWith(true)

    let addresses = form.getField('location.addresses')
    addresses.validate()
    expect(errors).toHaveBeenCalledWith('Invalid tenant')
    expect(isValid).toHaveBeenCalledWith(false)
  })

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
      'location.country.state.name': undefined,
      'location.addresses.0.street': 'Meridian',
      'location.addresses.0.tenants.0': 'John',
    })
  })

  it('getNestedSnapshot()', () => {
    expect(form.getNestedSnapshot()).toStrictEqual({
      location: {
        country: {
          state: { zip: '07016', name: undefined },
        },
        addresses: [{ street: 'Meridian', tenants: ['John'] }],
      },
    })
    form.getField('location.addresses.0').remove()
    expect(form.getNestedSnapshot()).toStrictEqual({
      location: {
        country: {
          state: { zip: '07016', name: undefined },
        },
      },
    })
  })

  describe('getPatch()', () => {
    it('Array fields', () => {
      let addresses = form.getField('location.addresses')
      runInAction(() => {
        addresses.value.push({ street: undefined, tenants: undefined })
      })
      // Ignores undefined values
      expect(form.getPatch()).toStrictEqual({})
      // Picks up new values
      addresses.getField('1.street').value = 'Washington'
      expect(form.getPatch()).toStrictEqual({
        'location.addresses.1.street': 'Washington',
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
})

let goodFields = {
  location: {
    fields: {
      'country.state': {
        label: 'Dotted field name',
        fields: {
          zip: {},
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
              },
            },
          },
        },
      },
    },
  },
}

let goodValue = {
  location: {
    'country.state': { zip: '07016' },
    addresses: [{ street: 'Meridian', tenants: ['John'] }],
  },
}

describe('submit()', () => {
  let form = null

  afterEach(() => form.dispose())
  it('fails when validation fails', async () => {
    const submit = async () => {
      return true
    }
    form = Form({ fields, value, submit })
    await form.submit()
    expect(form.submit.state.status).toBe('failed')
    expect(form.submit.state.error).toBe('Validation Error')
    expect(form.submitError).toBe('Validation Error')
  })
  it('succeeds when validation and sync submit() run', async () => {
    const submit = () => {
      return 'submit run'
    }
    form = Form({ fields: goodFields, value: goodValue, submit })
    const result = await form.submit()
    expect(form.submit.state.status).toBe('succeeded')
    expect(result).toBe('submit run')
  })
  it('succeeds when validation and async submit() run', async () => {
    const submit = async () => {
      return 'submit run'
    }
    form = Form({ fields: goodFields, value: goodValue, submit })
    const result = await form.submit()
    expect(form.submit.state.status).toBe('succeeded')
    expect(result).toBe('submit run')
  })
  it('has errors when sync submit throws with ValidationError', async () => {
    const submit = () => {
      throw new ValidationError('My submit failed', {
        'location.addresses.0.tenants.0': ['invalid format'],
      })
    }
    form = Form({ fields: goodFields, value: goodValue, submit })
    const result = await form.submit()
    expect(form.submit.state.status).toBe('failed')
    expect(form.submit.state.error.message).toBe('My submit failed')
    expect(form.submit.state.error.cause).toEqual({
      'location.addresses.0.tenants.0': ['invalid format'],
    })
    expect(form.errors).toEqual({
      'location.addresses.0.tenants.0': ['invalid format'],
    })
    expect(form.submitError).toBe('My submit failed')
    expect(result).toBeUndefined()
  })
  it('has errors when async submit throws with ValidationError', async () => {
    const submit = async () => {
      throw new ValidationError('My submit failed', {
        'location.addresses.0.tenants.0': ['invalid format'],
        '': ['top level error'],
      })
    }
    form = Form({ fields: goodFields, value: goodValue, submit })
    const result = await form.submit()
    expect(form.submit.state.status).toBe('failed')
    expect(form.submit.state.error.message).toBe('My submit failed')
    expect(form.submit.state.error.cause).toEqual({
      'location.addresses.0.tenants.0': ['invalid format'],
      '': ['top level error'],
    })
    expect(form.errors).toEqual({
      'location.addresses.0.tenants.0': ['invalid format'],
      '': ['top level error'],
    })
    expect(form.submitError).toBe('My submit failed')
    expect(result).toBeUndefined()
  })
})
